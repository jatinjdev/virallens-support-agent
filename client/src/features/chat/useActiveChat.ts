import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ConversationSummary, MessagePagination } from "./chat.types";
import { readConversationMessages } from "./chat.api";
import {
  messageText,
  reconcilePersistedUserId,
  toConversationSummary,
  toUIMessages,
  type ChatUIMessage
} from "./chat.messages";

const EMPTY_PAGE: MessagePagination = { hasMore: false, nextCursor: null };

interface ActiveChatOptions {
  userId?: string;
  conversationId?: string;
  onConversationUpdated(summary: ConversationSummary): void;
  onCreated(conversationId: string): void;
}

export function useActiveChat({
  userId,
  conversationId,
  onConversationUpdated,
  onCreated
}: ActiveChatOptions) {
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [activeChatId, setActiveChatId] = useState(() => conversationId ?? "new-0");
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pagination, setPagination] = useState<MessagePagination>(EMPTY_PAGE);
  const [error, setError] = useState("");
  const loadingOlderRef = useRef(false);
  const newChatSequenceRef = useRef(0);
  const loadedConversationIdRef = useRef<string | undefined>(undefined);
  const callbacksRef = useRef({ onConversationUpdated, onCreated });
  callbacksRef.current = { onConversationUpdated, onCreated };

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/chat/send",
    credentials: "include",
    prepareSendMessagesRequest({ messages }) {
      const latest = messages.at(-1) as ChatUIMessage | undefined;
      return {
        body: {
          message: latest ? messageText(latest) : "",
          ...(conversationId ? { conversationId } : {})
        }
      };
    }
  }), [conversationId]);

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status
  } = useChat<ChatUIMessage>({
    id: activeChatId,
    messages: [],
    transport,
    onError() {
      setError("We couldn't complete the response. Please try again.");
    },
    onFinish({ message: assistantMessage, finishReason }) {
      const streamedSummary = assistantMessage.metadata?.conversation;
      const now = new Date().toISOString();
      const id = streamedSummary?.id ?? conversationId;
      if (!id) return;

      loadedConversationIdRef.current = id;
      setMessages((current) => reconcilePersistedUserId(current, assistantMessage.metadata?.userMessageId));
      const summary: ConversationSummary = {
        id,
        title: streamedSummary?.title ?? conversation?.title ?? "New chat",
        lastMessage: messageText(assistantMessage)
          || streamedSummary?.lastMessage
          || conversation?.lastMessage
          || null,
        createdAt: streamedSummary?.createdAt ?? conversation?.createdAt ?? now,
        updatedAt: now
      };
      setConversation(summary);
      callbacksRef.current.onConversationUpdated(summary);
      if (finishReason === "length") setError("The response was cut short. Please try again.");
      if (!conversationId) callbacksRef.current.onCreated(id);
    }
  });
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;
  const sending = status === "submitted" || status === "streaming";

  useEffect(() => () => { void stop(); }, [conversationId, userId, stop]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      loadedConversationIdRef.current = undefined;
      setConversation(null);
      setMessagesRef.current([]);
      setPagination(EMPTY_PAGE);
      setLoading(false);
      return;
    }
    if (!conversationId) {
      if (loadedConversationIdRef.current) setActiveChatId(`new-${++newChatSequenceRef.current}`);
      loadedConversationIdRef.current = undefined;
      setConversation(null);
      setMessagesRef.current([]);
      setPagination(EMPTY_PAGE);
      setLoading(false);
      return;
    }
    if (loadedConversationIdRef.current === conversationId) return;

    setActiveChatId(conversationId);
    setError("");
    setLoading(true);
    setMessagesRef.current([]);
    void readConversationMessages(conversationId)
      .then((result) => {
        if (!cancelled) {
          loadedConversationIdRef.current = conversationId;
          setConversation(toConversationSummary(result.conversation));
          setMessagesRef.current(toUIMessages(result.conversation.messages));
          setPagination(result.pagination);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("This chat could not be loaded.");
          setConversation(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [conversationId, userId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !pagination.hasMore || !pagination.nextCursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const result = await readConversationMessages(conversationId, pagination.nextCursor);
      const olderMessages = toUIMessages(result.conversation.messages);
      setMessages((current) => [
        ...olderMessages,
        ...current.filter((item) => !olderMessages.some((older) => older.id === item.id))
      ]);
      setPagination(result.pagination);
    } catch {
      setError("Could not load earlier messages.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, pagination, setMessages]);

  const send = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;
    setError("");
    await sendMessage({ text: content.trim() });
  }, [sendMessage, sending]);

  const newChat = useCallback(() => {
    stop();
    loadedConversationIdRef.current = undefined;
    setActiveChatId(`new-${++newChatSequenceRef.current}`);
    setConversation(null);
    setMessages([]);
    setPagination(EMPTY_PAGE);
    setLoading(false);
    setError("");
  }, [setMessages, stop]);

  const prepareSwitch = useCallback((nextConversationId: string) => {
    if (nextConversationId === conversationId) return;
    stop();
    setActiveChatId(nextConversationId);
  }, [conversationId, stop]);

  return {
    sessionKey: activeChatId,
    conversation,
    messages,
    status,
    sending,
    loading,
    loadingOlder,
    canLoadOlder: pagination.hasMore,
    error,
    send,
    stop,
    newChat,
    prepareSwitch,
    loadOlder
  };
}
