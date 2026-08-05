import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app/App";
import { AuthProvider } from "./features/auth/AuthProvider";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/chat.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
