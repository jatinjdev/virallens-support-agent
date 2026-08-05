import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationSummary, MessagePagination } from "./chat.types";
import { listConversations } from "./chat.api";

const EMPTY_PAGE: MessagePagination = { hasMore: false, nextCursor: null };

export function useConversationList(userId?: string) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [pagination, setPagination] = useState<MessagePagination>(EMPTY_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setConversations([]);
    setPagination(EMPTY_PAGE);
    setError("");
    if (!userId) return;

    void listConversations()
      .then((result) => {
        if (!cancelled) {
          setConversations(result.conversations);
          setPagination(result.pagination);
        }
      })
      .catch(() => { if (!cancelled) setError("Could not load chat history."); });
    return () => { cancelled = true; };
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || !pagination.nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await listConversations(pagination.nextCursor);
      setConversations((current) => [
        ...current,
        ...result.conversations.filter((older) => !current.some((item) => item.id === older.id))
      ]);
      setPagination(result.pagination);
    } catch {
      setError("Could not load older conversations.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [pagination]);

  const upsert = useCallback((summary: ConversationSummary) => {
    setConversations((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
  }, []);

  return { conversations, loadingMore, error, loadMore, upsert };
}
