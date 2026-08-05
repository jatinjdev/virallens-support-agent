import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { AuthModal } from "../auth/AuthModal";
import { ChatComposer } from "./ChatComposer";
import { ConversationSidebar } from "./ConversationSidebar";
import { MessageList } from "./MessageList";
import { useActiveChat } from "./useActiveChat";
import { useConversationList } from "./useConversationList";

function MenuIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; }

export function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const loginTriggerRef = useRef<HTMLElement | null>(null);
  const messageRegionRef = useRef<HTMLDivElement>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const shouldScrollToBottomRef = useRef(false);
  const lastConversationIdRef = useRef<string | undefined>(undefined);
  const history = useConversationList(user?.id);
  const onCreated = useCallback((id: string) => navigate(`/c/${id}`, { replace: true }), [navigate]);
  const active = useActiveChat({
    userId: user?.id,
    conversationId,
    onConversationUpdated: history.upsert,
    onCreated
  });

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    queueMicrotask(() => menuButtonRef.current?.focus());
  }, []);

  const openLogin = useCallback(() => {
    loginTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLoginOpen(true);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeSidebar();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeSidebar, sidebarOpen]);

  useLayoutEffect(() => {
    const region = messageRegionRef.current;
    if (!region) return;
    if (restoreScrollRef.current) {
      const { height, top } = restoreScrollRef.current;
      region.scrollTop = region.scrollHeight - height + top;
      restoreScrollRef.current = null;
    } else if (!active.loading && (shouldScrollToBottomRef.current || (
      active.conversation?.id && active.conversation.id !== lastConversationIdRef.current
    ))) {
      region.scrollTop = region.scrollHeight;
      shouldScrollToBottomRef.current = false;
      lastConversationIdRef.current = active.conversation?.id;
    }
  }, [active.messages, active.conversation?.id, active.loading]);

  async function loadOlderMessages() {
    const region = messageRegionRef.current;
    if (region) restoreScrollRef.current = { height: region.scrollHeight, top: region.scrollTop };
    await active.loadOlder();
  }

  return (
    <main className="app-shell">
      <ConversationSidebar
        open={sidebarOpen}
        user={user}
        conversations={history.conversations}
        selectedConversationId={conversationId}
        loadingMore={history.loadingMore}
        onNewChat={() => { active.newChat(); closeSidebar(); }}
        onLogin={() => { closeSidebar(); openLogin(); }}
        onLogout={() => void logout()}
        onSelect={active.prepareSwitch}
        onClose={closeSidebar}
        onLoadMore={() => void history.loadMore()}
      />

      <section className="chat-panel" inert={sidebarOpen} aria-hidden={sidebarOpen || undefined}>
        <header className="chat-header">
          <button ref={menuButtonRef} className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><MenuIcon /></button>
          <div><p>{active.conversation?.title ?? "New chat"}</p></div>
        </header>

        <MessageList
          regionRef={messageRegionRef}
          messages={active.messages}
          status={active.status}
          loading={active.loading}
          loadingOlder={active.loadingOlder}
          canLoadOlder={active.canLoadOlder}
          onLoadOlder={() => void loadOlderMessages()}
        />

        <ChatComposer
          key={active.sessionKey}
          authenticated={Boolean(user)}
          sending={active.sending}
          error={active.error || history.error}
          onLogin={openLogin}
          onSend={async (message) => {
            shouldScrollToBottomRef.current = true;
            await active.send(message);
          }}
          onStop={() => void active.stop()}
        />
      </section>

      {!user && loginOpen && (
        <AuthModal
          restoreFocusTo={loginTriggerRef.current}
          onClose={() => setLoginOpen(false)}
          onAuthenticated={() => {
            setLoginOpen(false);
            navigate("/", { replace: true });
          }}
        />
      )}
    </main>
  );
}
