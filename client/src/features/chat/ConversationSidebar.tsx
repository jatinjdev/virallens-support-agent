import { useRef } from "react";
import { Link } from "react-router";
import type { User } from "../auth/auth.types";
import { Brand } from "../../shared/ui/Brand";
import type { ConversationSummary } from "./chat.types";
import { plainTextPreview } from "./chat.messages";

function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }
function LogoutIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="m15 8 4 4-4 4M19 12H9" /></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }

function relativeDate(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ConversationSidebarProps {
  open: boolean;
  user: User | null;
  conversations: ConversationSummary[];
  selectedConversationId?: string;
  loadingMore: boolean;
  onNewChat(): void;
  onLogin(): void;
  onLogout(): void;
  onSelect(conversationId: string): void;
  onClose(): void;
  onLoadMore(): void;
}

export function ConversationSidebar({
  open,
  user,
  conversations,
  selectedConversationId,
  loadingMore,
  onNewChat,
  onLogin,
  onLogout,
  onSelect,
  onClose,
  onLoadMore
}: ConversationSidebarProps) {
  const lastScrollTopRef = useRef(0);

  return (
    <>
      {open && <div className="sidebar-backdrop" aria-hidden="true" onClick={onClose} />}
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Navigation" : undefined}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <Brand />
            {open && <button className="icon-button sidebar-close" autoFocus onClick={onClose} aria-label="Close menu"><CloseIcon /></button>}
          </div>
          {user
            ? <Link className="new-button" to="/" onClick={onNewChat}><PlusIcon /> New chat</Link>
            : <button className="new-button" type="button" onClick={onLogin}><PlusIcon /> New chat</button>}
        </div>
        <div className="history-heading">Recent</div>
        <nav className="conversation-list" aria-label="Conversation history" onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
          const scrollingDown = scrollTop > lastScrollTopRef.current;
          lastScrollTopRef.current = scrollTop;
          if (scrollingDown && scrollHeight - scrollTop - clientHeight <= 80) onLoadMore();
        }}>
          {conversations.length === 0 && <p className="history-empty">Your conversations will appear here.</p>}
          {conversations.map((item) => (
            <Link
              key={item.id}
              to={`/c/${item.id}`}
              className={`conversation-item ${selectedConversationId === item.id ? "active" : ""}`}
              onClick={() => { onSelect(item.id); onClose(); }}
            >
              <span className="conversation-title">{item.title}</span>
              <span className="conversation-preview">
                {item.lastMessage ? plainTextPreview(item.lastMessage) : "No messages yet"}
              </span>
              <time>{relativeDate(item.updatedAt)}</time>
            </Link>
          ))}
          {loadingMore && <p className="history-loading">Loading older chats…</p>}
        </nav>
        {user ? (
          <div className="user-menu">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
            <button onClick={onLogout} title="Sign out" aria-label="Sign out"><LogoutIcon /></button>
          </div>
        ) : (
          <div className="guest-menu"><button className="login-button" onClick={onLogin}>Log in</button></div>
        )}
      </aside>
    </>
  );
}
