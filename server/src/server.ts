import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { createOpenRouterModel } from "./integrations/openrouter.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const model = createOpenRouterModel(config.OPENROUTER_API_KEY, config.OPENROUTER_MODEL);
const clientDistPath = fileURLToPath(new URL("../../client/dist", import.meta.url));

await mongoose.connect(config.MONGODB_URI);
const server = createApp(config, model, clientDistPath).listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${config.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
