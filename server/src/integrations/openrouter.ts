import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export function createOpenRouterModel(apiKey: string, model: string): LanguageModel {
  const openrouter = createOpenRouter({
    apiKey,
    appName: "Beacon",
    compatibility: "strict"
  });
  return openrouter.chat(model);
}
