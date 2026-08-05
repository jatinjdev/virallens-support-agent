import { useRef, type RefObject } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { Spinner } from "../../shared/ui/Spinner";
import {
  messageText,
  normalizeAssistantMarkdown,
  type ChatUIMessage
} from "./chat.messages";

interface MessageListProps {
  regionRef: RefObject<HTMLDivElement | null>;
  messages: ChatUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  loading: boolean;
  loadingOlder: boolean;
  canLoadOlder: boolean;
  onLoadOlder(): void;
}

export function MessageList({
  regionRef,
  messages,
  status,
  loading,
  loadingOlder,
  canLoadOlder,
  onLoadOlder
}: MessageListProps) {
  const lastScrollTopRef = useRef(0);
  const sending = status === "submitted" || status === "streaming";
  return (
    <div ref={regionRef} className="message-region" aria-live="polite" onScroll={(event) => {
      const scrollTop = event.currentTarget.scrollTop;
      const scrollingUp = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;
      if (canLoadOlder && scrollingUp && scrollTop <= 80) onLoadOlder();
    }}>
      {loading ? <Spinner label="Loading chat" /> : messages.length === 0 ? (
        <div className="welcome-state">
          <h1>How can we help?</h1>
          <p>Describe what you need help with.</p>
        </div>
      ) : (
        <div className="messages">
          {loadingOlder && <div className="older-messages-loading">Loading earlier messages…</div>}
          {messages.map((item, index) => {
            const content = messageText(item);
            const streaming = item.role === "assistant" && index === messages.length - 1 && sending;
            const incomplete = streaming || item.metadata?.status === "failed";
            return (
              <article key={item.id} className={`message ${item.role}`}>
                <div>
                  {streaming && !content ? (
                    <span className="typing"><i /><i /><i /></span>
                  ) : item.role === "assistant" ? (
                    <Streamdown
                      className="message-markdown"
                      mode={incomplete ? "streaming" : "static"}
                      isAnimating={streaming}
                      parseIncompleteMarkdown
                      controls={false}
                      skipHtml
                    >
                      {normalizeAssistantMarkdown(content)}
                    </Streamdown>
                  ) : (
                    <p>{content}</p>
                  )}
                </div>
              </article>
            );
          })}
          {status === "submitted" && messages.at(-1)?.role === "user" && (
            <article className="message assistant"><div><span className="typing"><i /><i /><i /></span></div></article>
          )}
        </div>
      )}
    </div>
  );
}
