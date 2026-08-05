import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { User } from "../src/modules/auth/user.model.js";
import { config, signup, testModel } from "./support.js";

describe("authentication", () => {
  it("creates a private session and never stores the plaintext password", async () => {
    const agent = request.agent(createApp(config, testModel()));
    const created = await signup(agent);
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(created.headers["set-cookie"]?.[0]).toContain("HttpOnly");

    const stored = await User.findOne({ email: "ada@example.com" }).select("+passwordHash");
    expect(stored?.passwordHash).not.toBe("correct-horse");

    expect((await agent.get("/auth/session")).status).toBe(200);
    expect((await agent.post("/auth/logout")).status).toBe(204);
    expect((await agent.get("/auth/session")).status).toBe(401);
  });

  it("rejects duplicate accounts and invalid credentials", async () => {
    const app = createApp(config, testModel());
    await signup(request.agent(app));
    expect((await signup(request.agent(app))).status).toBe(409);
    expect((await request(app).post("/auth/login").send({
      email: "ada@example.com",
      password: "wrong-pass",
    })).status).toBe(401);
  });

  it("rejects browser mutations from an untrusted origin", async () => {
    const app = createApp(config, testModel());
    const response = await request(app).post("/auth/signup").set("Origin", "https://malicious.example").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct-horse",
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("UNTRUSTED_ORIGIN");
  });

  it("returns a safe 400 for malformed JSON without logging parser internals", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request(createApp(config, testModel()))
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." }
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
