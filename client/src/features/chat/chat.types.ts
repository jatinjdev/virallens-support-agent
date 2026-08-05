export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "completed" | "failed";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePagination {
  hasMore: boolean;
  nextCursor: string | null;
}
