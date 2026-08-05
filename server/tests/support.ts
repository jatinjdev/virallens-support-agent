import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { AppConfig } from "../src/config/env.js";

export function testModel(reply = "Test reply") {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: reply },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 2, text: 2, reasoning: undefined },
            },
          },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    }),
  });
}

export function failingModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [{ type: "error", error: new Error("provider unavailable") }],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    }),
  });
}

export type StreamEvent = Record<string, unknown> & { type: string | undefined };

export function streamEvents(response: request.Response): StreamEvent[] {
  return response.text.trim().split(/\n\n/).flatMap((frame) => {
    const lines = frame.split("\n");
    const type = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
    const data = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";
    if (data === "[DONE]") return [];
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return [{ ...parsed, type: type ?? (typeof parsed.type === "string" ? parsed.type : undefined) }];
  });
}

export const config: AppConfig = {
  NODE_ENV: "test",
  PORT: 4000,
  MONGODB_URI: "unused",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
  CLIENT_ORIGIN: "http://localhost:5173",
  secureCookies: false,
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_MODEL: "openrouter/free",
};

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

export async function signup(agent: ReturnType<typeof request.agent>, email = "ada@example.com") {
  return agent.post("/auth/signup").send({ name: "Ada Lovelace", email, password: "correct-horse" });
}
