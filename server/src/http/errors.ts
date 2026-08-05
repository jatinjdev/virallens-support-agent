import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function isJsonParseError(error: unknown): error is SyntaxError {
  if (!(error instanceof SyntaxError) || typeof error !== "object" || error === null) return false;
  const parserError = error as SyntaxError & { status?: unknown; type?: unknown };
  return parserError.status === 400 && parserError.type === "entity.parse.failed";
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  if (isJsonParseError(error)) {
    response.status(400).json({
      error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." }
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Please check the submitted fields.", details: error.flatten() }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  console.error(error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
};
