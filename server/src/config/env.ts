import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().url(),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default("openrouter/free")
});

type ParsedConfig = z.infer<typeof envSchema>;
export type AppConfig = ParsedConfig & { secureCookies: boolean };

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return {
    ...result.data,
    secureCookies: result.data.NODE_ENV === "production"
      && new URL(result.data.CLIENT_ORIGIN).protocol === "https:"
  };
}
