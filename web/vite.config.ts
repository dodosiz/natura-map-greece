import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In dev, /api is proxied to the FastAPI backend so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"] },
  server: { port: 5173, proxy: { "/api": process.env.VITE_PROXY_TARGET ?? "http://localhost:8000" } },
});
