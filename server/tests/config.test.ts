import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

const baseEnv = {
  PORT: "4000",
  MONGODB_URI: "mongodb://localhost/test",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
  CLIENT_ORIGIN: "http://localhost:5173",
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_MODEL: "openrouter/free"
};

describe("environment configuration", () => {
  it("uses localhost-safe cookies in development", () => {
    expect(loadConfig({ ...baseEnv, NODE_ENV: "development" }).secureCookies).toBe(false);
  });

  it("uses secure cookies in production by default", () => {
    expect(loadConfig({
      ...baseEnv,
      NODE_ENV: "production",
      CLIENT_ORIGIN: "https://support.example.com"
    }).secureCookies).toBe(true);
  });

  it("uses localhost-safe cookies for the production build preview", () => {
    expect(loadConfig({ ...baseEnv, NODE_ENV: "production" }).secureCookies).toBe(false);
  });
});
