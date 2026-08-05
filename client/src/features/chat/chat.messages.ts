import type { UIMessage } from "ai";
import type { Conversation, ConversationSummary, Message } from "./chat.types";

type ChatMetadata = {
  conversation?: ConversationSummary;
  userMessageId?: string;
  status?: Message["status"];
};

export type ChatUIMessage = UIMessage<ChatMetadata>;

export function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part): part is Extract<ChatUIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function normalizeAssistantMarkdown(content: string): string {
  return content.replace(/<br\s*\/?\s*>/gi, "\n");
}

export function plainTextPreview(content: string): string {
  return normalizeAssistantMarkdown(content)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_~`|>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toUIMessages(messages: Message[]): ChatUIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
    metadata: { status: message.status }
  }));
}

export function toConversationSummary(conversation: Conversation): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    lastMessage: conversation.messages.at(-1)?.content ?? null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export function reconcilePersistedUserId(messages: ChatUIMessage[], userMessageId?: string): ChatUIMessage[] {
  if (!userMessageId) return messages;
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  if (lastUserIndex < 0 || messages[lastUserIndex]!.id === userMessageId) return messages;
  return messages.map((message, index) => index === lastUserIndex ? { ...message, id: userMessageId } : message);
}
