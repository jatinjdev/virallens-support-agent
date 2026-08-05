import { Router } from "express";
import { z } from "zod";
import { pipeUIMessageStreamToResponse, toUIMessageStream } from "ai";
import { authenticatedUserId } from "../auth/session.js";
import { ChatService } from "./chat.service.js";

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid conversation ID");
const sendSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  conversationId: idSchema.optional()
});
const historyPageSchema = z.object({
  before: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});
const historyListSchema = z.object({
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export function createChatRouter(module: ChatService): Router {
  const router = Router();

  router.post("/send", async (request, response) => {
    const { message, conversationId } = sendSchema.parse(request.body);
    const abortController = new AbortController();
    response.once("close", () => {
      if (!response.writableEnded) abortController.abort(new Error("Client disconnected"));
    });
    const session = await module.send(
      authenticatedUserId(request),
      conversationId,
      message,
      abortController.signal
    );
    const stream = toUIMessageStream({
      stream: session.result.stream,
      sendReasoning: false,
      generateMessageId: () => session.assistantMessageId,
      messageMetadata: ({ part }) => part.type === "start"
        ? {
            conversation: session.conversation,
            userMessageId: session.userMessageId
          }
        : undefined,
      onError: () => "We couldn't complete the response. Please try again."
    });
    await pipeUIMessageStreamToResponse({ response, stream });
  });

  router.get("/history", async (request, response) => {
    const { before, limit } = historyListSchema.parse(request.query);
    response.json(await module.list(authenticatedUserId(request), before, limit));
  });

  router.get("/history/:conversationId", async (request, response) => {
    const conversationId = idSchema.parse(request.params.conversationId);
    const { before, limit } = historyPageSchema.parse(request.query);
    response.json(await module.readMessages(authenticatedUserId(request), conversationId, before, limit));
  });

  return router;
}
