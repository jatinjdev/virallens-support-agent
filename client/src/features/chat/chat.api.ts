import { api } from "../../shared/api/client";
import type { Conversation, ConversationSummary, MessagePagination } from "./chat.types";

export interface ConversationListPage {
  conversations: ConversationSummary[];
  pagination: MessagePagination;
}

export interface ConversationMessagePage {
  conversation: Conversation;
  pagination: MessagePagination;
}

export function listConversations(before?: string): Promise<ConversationListPage> {
  const query = new URLSearchParams();
  if (before) query.set("before", before);
  query.set("limit", "20");
  return api<ConversationListPage>(`/chat/history?${query}`);
}

export function readConversationMessages(
  conversationId: string,
  before?: string
): Promise<ConversationMessagePage> {
  const query = new URLSearchParams();
  if (before) query.set("before", before);
  query.set("limit", "30");
  return api<ConversationMessagePage>(`/chat/history/${conversationId}?${query}`);
}
