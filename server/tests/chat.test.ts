import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { User } from "../src/modules/auth/user.model.js";
import { Message } from "../src/modules/chat/message.model.js";
import { config, failingModel, signup, streamEvents, testModel } from "./support.js";

describe("chat", () => {
  it("creates and continues a chat, generates replies, and returns its history", async () => {
    const agent = request.agent(createApp(config, testModel()));
    await signup(agent);

    const sent = await agent.post("/chat/send").send({ message: "Where is my order?" });
    expect(sent.status).toBe(200);
    expect(sent.headers["content-type"]).toContain("text/event-stream");
    const sentEvents = streamEvents(sent);
    expect(sentEvents.filter((event) => event.type === "text-delta").map((event) => String(event.delta)).join("")).toBe("Test reply");
    const start = sentEvents.find((event) => event.type === "start") as unknown as {
      messageId: string;
      messageMetadata: { conversation: { id: string; title: string }; userMessageId: string };
    };
    const conversationId = start.messageMetadata.conversation.id;
    expect(start.messageMetadata.conversation.title).toBe("Where is my order?");

    const continued = await agent.post("/chat/send").send({
      message: "It was due yesterday.",
      conversationId,
    });
    expect(continued.status).toBe(200);
    expect(streamEvents(continued).map((event) => event.type)).toContain("finish");

    const history = await agent.get("/chat/history");
    expect(history.status).toBe(200);
    expect(history.body.conversations).toHaveLength(1);
    expect(history.body.conversations[0]).toMatchObject({ id: conversationId, lastMessage: "Test reply" });
    expect(history.body.conversations[0].messages).toBeUndefined();
    expect(history.body.pagination).toEqual({ hasMore: false, nextCursor: null });

    const detail = await agent.get(`/chat/history/${conversationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.conversation.messages).toHaveLength(4);
    expect(detail.body.conversation.messages[0].id).toBe(start.messageMetadata.userMessageId);
    expect(detail.body.conversation.messages[1].id).toBe(start.messageId);
    expect(detail.body.pagination).toEqual({ hasMore: false, nextCursor: null });

    const latestPage = await agent.get(`/chat/history/${conversationId}?limit=2`);
    expect(latestPage.body.conversation.messages).toHaveLength(2);
    expect(latestPage.body.pagination.hasMore).toBe(true);
    const olderPage = await agent.get(
      `/chat/history/${conversationId}?limit=2&before=${latestPage.body.pagination.nextCursor}`,
    );
    expect(olderPage.body.conversation.messages).toHaveLength(2);
    expect(olderPage.body.pagination).toEqual({ hasMore: false, nextCursor: null });
  });

  it("paginates conversation summaries with an opaque cursor", async () => {
    const agent = request.agent(createApp(config, testModel()));
    await signup(agent);
    for (const message of ["First chat", "Second chat", "Third chat"]) {
      await agent.post("/chat/send").send({ message });
    }

    const latest = await agent.get("/chat/history?limit=2");
    expect(latest.status).toBe(200);
    expect(latest.body.conversations).toHaveLength(2);
    expect(latest.body.pagination.hasMore).toBe(true);
    expect(latest.body.pagination.nextCursor).toEqual(expect.any(String));

    const older = await agent.get(`/chat/history?limit=2&before=${latest.body.pagination.nextCursor}`);
    expect(older.status).toBe(200);
    expect(older.body.conversations).toHaveLength(1);
    expect(older.body.pagination).toEqual({ hasMore: false, nextCursor: null });
    expect(new Set([...latest.body.conversations, ...older.body.conversations].map((item) => item.id)).size).toBe(3);
  });

  it("keeps concurrent message writes and bounds the model context", async () => {
    const model = testModel();
    const agent = request.agent(createApp(config, model));
    await signup(agent);
    const first = await agent.post("/chat/send").send({ message: "Message 1" });
    const start = streamEvents(first).find((event) => event.type === "start") as unknown as {
      messageMetadata: { conversation: { id: string } };
    };
    const conversationId = start.messageMetadata.conversation.id;

    await Promise.all([
      agent.post("/chat/send").send({ message: "Message 2", conversationId }),
      agent.post("/chat/send").send({ message: "Message 3", conversationId }),
    ]);
    const concurrentDetail = await agent.get(`/chat/history/${conversationId}?limit=50`);
    expect(concurrentDetail.body.conversation.messages).toHaveLength(6);
    const user = await User.findOne({ email: "ada@example.com" });
    await Message.insertMany(Array.from({ length: 50 }, (_, index) => ({
      conversationId,
      userId: user!._id,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Seeded message ${index + 1}`,
      status: "completed",
      createdAt: new Date(Date.now() + index),
    })));
    await agent.post("/chat/send").send({ message: "Latest message", conversationId });

    const latestPrompt = model.doStreamCalls.at(-1)!.prompt;
    expect(latestPrompt.filter((message) => message.role !== "system").length).toBeLessThanOrEqual(40);
    const detail = await agent.get(`/chat/history/${conversationId}?limit=50`);
    expect(detail.body.conversation.messages).toHaveLength(50);
    expect(detail.body.pagination.hasMore).toBe(true);
  });

  it("does not reveal whether another user's conversation exists", async () => {
    const app = createApp(config, testModel());
    const owner = request.agent(app);
    const stranger = request.agent(app);
    await signup(owner, "owner@example.com");
    await signup(stranger, "stranger@example.com");
    const sent = await owner.post("/chat/send").send({ message: "Private question" });
    const start = streamEvents(sent).find((event) => event.type === "start") as unknown as {
      messageMetadata: { conversation: { id: string } };
    };
    const id = start.messageMetadata.conversation.id;

    expect((await stranger.post("/chat/send").send({ message: "Intrusion", conversationId: id })).status).toBe(404);
    expect((await stranger.get(`/chat/history/${id}`)).status).toBe(404);
    expect((await stranger.get("/chat/history")).body.conversations).toHaveLength(0);
  });

  it("validates empty and oversized messages", async () => {
    const agent = request.agent(createApp(config, testModel()));
    await signup(agent);
    expect((await agent.post("/chat/send").send({ message: "   " })).status).toBe(400);
    expect((await agent.post("/chat/send").send({ message: "x".repeat(4_001) })).status).toBe(400);
  });

  it("retains a failed assistant message and bounds its conversation preview", async () => {
    const agent = request.agent(createApp(config, failingModel()));
    await signup(agent);
    const message = `Please help ${"with this issue ".repeat(40)}`;

    const failed = await agent.post("/chat/send").send({ message });
    expect(failed.status).toBe(200);
    expect(streamEvents(failed).map((event) => event.type)).toContain("error");
    const history = await agent.get("/chat/history");
    expect(history.body.conversations).toHaveLength(1);
    expect(history.body.conversations[0].lastMessage).toHaveLength(500);
    expect(history.body.conversations[0].lastMessage).toMatch(/\.\.\.$/);
    expect(history.body.conversations[0].messages).toBeUndefined();
    const detail = await agent.get(`/chat/history/${history.body.conversations[0].id}`);
    expect(detail.body.conversation.messages).toHaveLength(2);
    expect(detail.body.conversation.messages[1]).toMatchObject({ role: "assistant", status: "failed" });
  });
});
