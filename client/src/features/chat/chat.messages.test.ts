import { describe, expect, it } from "vitest";
import {
  normalizeAssistantMarkdown,
  plainTextPreview,
  reconcilePersistedUserId,
  toConversationSummary,
  toUIMessages
} from "./chat.messages";

describe("chat message adapter", () => {
  const conversation = {
    id: "conversation-1",
    title: "Delivery question",
    messages: [{
      id: "message-1",
      role: "user" as const,
      content: "Where is my order?",
      status: "completed" as const,
      createdAt: "2026-08-04T00:00:00.000Z"
    }],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:01:00.000Z"
  };

  it("converts persisted records at the AI SDK seam", () => {
    expect(toUIMessages(conversation.messages)).toEqual([{
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "Where is my order?" }],
      metadata: { status: "completed" }
    }]);
    expect(toConversationSummary(conversation)).toMatchObject({
      id: "conversation-1",
      lastMessage: "Where is my order?"
    });
  });

  it("reconciles only the latest optimistic user message", () => {
    const messages = [
      { id: "older-user", role: "user" as const, parts: [{ type: "text" as const, text: "First" }] },
      { id: "optimistic-user", role: "user" as const, parts: [{ type: "text" as const, text: "Second" }] },
      { id: "persisted-assistant", role: "assistant" as const, parts: [{ type: "text" as const, text: "Reply" }] }
    ];

    expect(reconcilePersistedUserId(messages, "persisted-user").map((message) => message.id)).toEqual([
      "older-user",
      "persisted-user",
      "persisted-assistant"
    ]);
  });

  it("normalizes streamed Markdown and produces plain conversation previews", () => {
    const content = "### Update<br>**Order:** [View details](https://example.com) | Ready";

    expect(normalizeAssistantMarkdown(content)).toBe(
      "### Update\n**Order:** [View details](https://example.com) | Ready"
    );
    expect(plainTextPreview(content)).toBe("Update Order: View details Ready");
  });
});
