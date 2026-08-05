import { Types } from "mongoose";
import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { AppError } from "../../http/errors.js";
import { Conversation, type ConversationRecord } from "./conversation.model.js";
import { Message, type MessageRecord } from "./message.model.js";

const MODEL_CONTEXT_MESSAGE_LIMIT = 40;
const LAST_MESSAGE_PREVIEW_LIMIT = 500;
const PROVIDER_FAILURE_MESSAGE = "The assistant could not respond. Please try again.";

interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationDetail extends Omit<ConversationSummary, "lastMessage"> {
  messages: Array<{
    id: string;
    role: MessageRecord["role"];
    content: string;
    status: MessageRecord["status"];
    createdAt: Date;
  }>;
}

function titleFrom(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 56 ? `${compact.slice(0, 53)}...` : compact;
}

function previewFrom(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > LAST_MESSAGE_PREVIEW_LIMIT
    ? `${compact.slice(0, LAST_MESSAGE_PREVIEW_LIMIT - 3)}...`
    : compact;
}

function toSummary(conversation: ConversationRecord & { _id: unknown }): ConversationSummary {
  return {
    id: String(conversation._id),
    title: conversation.title,
    lastMessage: conversation.lastMessagePreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

function toDetail(
  conversation: ConversationRecord & { _id: unknown },
  messages: Array<MessageRecord & { _id: unknown }>
): ConversationDetail {
  return {
    id: String(conversation._id),
    title: conversation.title,
    messages: messages.map((message) => ({
      id: String(message._id),
      role: message.role,
      content: message.content,
      status: message.status,
      createdAt: message.createdAt
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export class ChatService {
  constructor(private readonly model: LanguageModel) {}

  async list(userId: string, before: string | undefined, limit: number) {
    const cursor = before ? decodeHistoryCursor(before) : null;
    const cursorFilter = cursor
      ? {
          $or: [
            { updatedAt: { $lt: cursor.updatedAt } },
            { updatedAt: cursor.updatedAt, _id: { $lt: cursor.id } }
          ]
        }
      : {};
    const results = await Conversation.find({ userId, ...cursorFilter })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = results.length > limit;
    const conversations = hasMore ? results.slice(0, limit) : results;
    const last = conversations.at(-1);
    return {
      conversations: conversations.map(toSummary),
      pagination: {
        hasMore,
        nextCursor: hasMore && last ? encodeHistoryCursor(last.updatedAt, last._id) : null
      }
    };
  }

  async readMessages(userId: string, conversationId: string, before: string | undefined, limit: number) {
    const conversation = await this.readConversation(userId, conversationId);
    const results = await Message.find({
      userId,
      conversationId,
      ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {})
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = results.length > limit;
    const pageDescending = hasMore ? results.slice(0, limit) : results;
    const messages = pageDescending.reverse();
    return {
      conversation: toDetail(conversation, messages),
      pagination: {
        hasMore,
        nextCursor: hasMore ? String(messages[0]!._id) : null
      }
    };
  }

  async send(
    userId: string,
    conversationId: string | undefined,
    content: string,
    abortSignal?: AbortSignal
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const conversation = conversationId
      ? await this.readConversation(userId, conversationId)
      : await Conversation.create({
          userId: userObjectId,
          title: titleFrom(content),
          lastMessagePreview: null
        });
    const conversationObjectId = conversation._id;
    const userMessageId = new Types.ObjectId();
    const assistantMessageId = new Types.ObjectId();
    const userMessageCreatedAt = new Date();

    await Message.create({
      _id: userMessageId,
      conversationId: conversationObjectId,
      userId: userObjectId,
      role: "user",
      content,
      status: "completed",
      createdAt: userMessageCreatedAt
    });
    await Conversation.updateOne(
      { _id: conversationObjectId, userId: userObjectId },
      { $set: { lastMessagePreview: previewFrom(content), updatedAt: userMessageCreatedAt } }
    );
    conversation.lastMessagePreview = previewFrom(content);
    conversation.updatedAt = userMessageCreatedAt;

    const recentMessages = await Message.find({
      userId: userObjectId,
      conversationId: conversationObjectId,
      status: "completed"
    })
      .sort({ _id: -1 })
      .limit(MODEL_CONTEXT_MESSAGE_LIMIT)
      .select({ role: 1, content: 1, _id: 0 })
      .lean();
    const history: ModelMessage[] = recentMessages.reverse().map(({ role, content: messageContent }) => ({
      role,
      content: messageContent
    }));

    let finalized = false;
    const finalize = async (reply: string, status: MessageRecord["status"]) => {
      if (finalized) return;
      finalized = true;
      const response = reply || PROVIDER_FAILURE_MESSAGE;
      const createdAt = new Date();
      await Message.create({
        _id: assistantMessageId,
        conversationId: conversationObjectId,
        userId: userObjectId,
        role: "assistant",
        content: response,
        status,
        createdAt
      });
      if (reply.trim()) {
        await Conversation.updateOne(
          { _id: conversationObjectId, userId: userObjectId },
          { $set: { lastMessagePreview: previewFrom(response), updatedAt: createdAt } }
        );
      }
    };
    let streamedReply = "";

    const result = streamText({
      model: this.model,
      instructions: `You are Beacon, a concise and empathetic customer support assistant.
Ask one focused follow-up question when information is missing.
Never invent policies, account details, refunds, or actions you did not perform.
Clearly say when a request requires a human support representative.
Use standard Markdown for structure when helpful, and never emit HTML.`,
      messages: history,
      temperature: 0.3,
      maxOutputTokens: 2_048,
      maxRetries: 2,
      timeout: { totalMs: 60_000, firstChunkMs: 30_000, chunkMs: 20_000 },
      ...(abortSignal ? { abortSignal } : {}),
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") streamedReply += chunk.text;
      },
      onFinish: async ({ text, finishReason }) => {
        await finalize(text, finishReason === "stop" ? "completed" : "failed");
      },
      onAbort: async () => {
        if (streamedReply.trim()) await finalize(streamedReply, "failed");
        else finalized = true;
      },
      onError: async () => {
        await finalize("", "failed");
      }
    });

    return {
      conversation: toSummary(conversation),
      result,
      userMessageId: String(userMessageId),
      assistantMessageId: String(assistantMessageId)
    };
  }

  private async readConversation(userId: string, conversationId: string) {
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    return conversation;
  }
}

function encodeHistoryCursor(updatedAt: Date, id: unknown): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id: String(id) })).toString("base64url");
}

function decodeHistoryCursor(value: string): { updatedAt: Date; id: Types.ObjectId } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { updatedAt?: unknown; id?: unknown };
    const updatedAt = new Date(String(parsed.updatedAt));
    if (Number.isNaN(updatedAt.getTime()) || typeof parsed.id !== "string" || !Types.ObjectId.isValid(parsed.id)) {
      throw new Error("Invalid cursor");
    }
    return { updatedAt, id: new Types.ObjectId(parsed.id) };
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Invalid history cursor.");
  }
}
