import type { CookieOptions, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../http/errors.js";

export const SESSION_COOKIE = "support_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload extends jwt.JwtPayload {
  sub: string;
}

export function createSessionToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: SESSION_DURATION_SECONDS });
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS * 1000,
    path: "/"
  };
}

export function requireAuth(secret: string): RequestHandler {
  return (request, _response, next) => {
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      next(new AppError(401, "UNAUTHENTICATED", "Please sign in to continue."));
      return;
    }

    try {
      const payload = jwt.verify(token, secret) as SessionPayload;
      if (!payload.sub) throw new Error("Missing subject");
      request.userId = payload.sub;
      next();
    } catch {
      next(new AppError(401, "UNAUTHENTICATED", "Your session is invalid or has expired."));
    }
  };
}

export function authenticatedUserId(request: Express.Request): string {
  if (!request.userId) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return request.userId;
}
