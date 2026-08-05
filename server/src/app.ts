import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { LanguageModel } from "ai";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { requireAuth } from "./modules/auth/session.js";
import { ChatService } from "./modules/chat/chat.service.js";
import { createChatRouter } from "./modules/chat/chat.routes.js";
import type { AppConfig } from "./config/env.js";
import { AppError, errorHandler } from "./http/errors.js";
import cookieParser from "cookie-parser";
import { AuthService } from "./modules/auth/auth.service.js";

export function createApp(config: AppConfig, model: LanguageModel, clientDistPath?: string) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((request, _response, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.get("origin");
      if (origin && origin !== config.CLIENT_ORIGIN) {
        next(new AppError(403, "UNTRUSTED_ORIGIN", "Something went wrong."));
        return;
      }
    }
    next();
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
  const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
  const authService = new AuthService();
  const requireSession = requireAuth(config.JWT_SECRET);
  const chat = new ChatService(model);

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/auth", authLimiter, createAuthRouter(config, authService));
  app.use("/chat", requireSession, chatLimiter, createChatRouter(chat));

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.use((request, response, next) => {
      if (request.method !== "GET" || /^\/(auth|chat|health)(\/|$)/.test(request.path)) {
        next();
        return;
      }
      response.sendFile("index.html", { root: clientDistPath }, (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((_request, _response, next) => next(new AppError(404, "NOT_FOUND", "Route not found.")));
  app.use(errorHandler);
  return app;
}
