import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/auth": "http://localhost:4000",
      "/chat": "http://localhost:4000",
      "/health": "http://localhost:4000"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
