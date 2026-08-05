import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import { Brand } from "../../shared/ui/Brand";
import { useAuth } from "./AuthProvider";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  EMAIL_IN_USE: "An account with this email already exists.",
  VALIDATION_ERROR: "Check your details and try again."
};

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return AUTH_ERROR_MESSAGES[error.code] ?? "Something went wrong.";
  return "Something went wrong.";
}

type AuthModalProps = {
  onClose(): void;
  onAuthenticated(): void;
  restoreFocusTo?: HTMLElement | null;
};

export function AuthModal({ onClose, onAuthenticated, restoreFocusTo }: AuthModalProps) {
  const { login, signup } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    emailRef.current?.focus();
    const focusTarget = restoreFocusTo ?? previousFocus;

    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      queueMicrotask(() => focusTarget?.focus());
    };
  }, [restoreFocusTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password);
      onAuthenticated();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-modal"
      aria-labelledby="auth-title"
      aria-describedby="auth-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="auth-card">
        <button className="auth-modal-close" onClick={onClose} aria-label="Close login">×</button>
        <Brand />
        <h2 id="auth-title">{mode === "login" ? "Sign in to Beacon" : "Create your account"}</h2>
        <p id="auth-description" className="auth-subtitle">{mode === "login" ? "Sign in to continue." : "Enter your details to create an account."}</p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} required /></label>
          )}
          <label>Email address<input ref={emailRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "New to Beacon?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </dialog>
  );
}
