import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "../features/auth/AuthProvider";
import { ChatPage } from "../features/chat/ChatPage";

export function App() {
  const { loading, sessionUnavailable } = useAuth();
  if (loading) return null;
  if (sessionUnavailable) {
    return <main className="session-unavailable" role="alert">
      <h1>Beacon is temporarily unavailable.</h1>
      <p>We couldn't restore your session. Check your connection and try again.</p>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
    </main>;
  }

  return <Routes>
    <Route path="/" element={<ChatPage />} />
    <Route path="/c/:conversationId" element={<ChatPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
