import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "./auth.service.js";
import {
  SESSION_COOKIE,
  authenticatedUserId,
  createSessionToken,
  requireAuth,
  sessionCookieOptions
} from "./session.js";

const credentialsSchema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  password: z.string().min(8).max(128)
});

const signupSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80)
});

export function createAuthRouter(config: AppConfig, auth: AuthService): Router {
  const router = Router();
  const cookieOptions = sessionCookieOptions(config.secureCookies);

  router.post("/signup", async (request, response) => {
    const input = signupSchema.parse(request.body);
    const user = await auth.signup(input);
    response.cookie(SESSION_COOKIE, createSessionToken(user.id, config.JWT_SECRET), cookieOptions);
    response.status(201).json({ user });
  });

  router.post("/login", async (request, response) => {
    const input = credentialsSchema.parse(request.body);
    const user = await auth.login(input);
    response.cookie(SESSION_COOKIE, createSessionToken(user.id, config.JWT_SECRET), cookieOptions);
    response.json({ user });
  });

  router.post("/logout", (_request, response) => {
    response.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
    response.status(204).send();
  });

  router.get("/session", requireAuth(config.JWT_SECRET), async (request, response) => {
    response.json({ user: await auth.session(authenticatedUserId(request)) });
  });

  return router;
}
