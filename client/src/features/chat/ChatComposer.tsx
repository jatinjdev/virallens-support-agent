import { useState, type FormEvent } from "react";

function SendIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 16-8-6 16-2.5-6.5L4 12Z" /><path d="M11.5 13.5 20 4" /></svg>; }
function StopIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg>; }

interface ChatComposerProps {
  authenticated: boolean;
  sending: boolean;
  error: string;
  onLogin(): void;
  onSend(message: string): Promise<void>;
  onStop(): void;
}

export function ChatComposer({ authenticated, sending, error, onLogin, onSend, onStop }: ChatComposerProps) {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!authenticated) {
      onLogin();
      return;
    }
    const content = message.trim();
    if (!content || sending) return;
    setMessage("");
    await onSend(content);
  }

  return (
    <footer className="composer-area">
      {error && <div className="chat-error" role="alert">{error}</div>}
      <form className="composer" onSubmit={submit}>
        <textarea
          value={message}
          readOnly={!authenticated}
          onClick={() => { if (!authenticated) onLogin(); }}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={authenticated ? "Message Beacon…" : "Log in to start a chat"}
          rows={1}
          maxLength={4000}
          aria-label="Message Beacon"
        />
        {sending
          ? <button className="stop-button" type="button" onClick={onStop} aria-label="Stop generating"><StopIcon /></button>
          : <button disabled={!message.trim()} aria-label="Send message"><SendIcon /></button>}
      </form>
      <p>Beacon can make mistakes. Check important information.</p>
    </footer>
  );
}
