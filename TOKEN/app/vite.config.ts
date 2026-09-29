import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  // The bundled o200k_base tokenizer data is a single ~2.3 MB lazy chunk by design.
  build: { chunkSizeWarningLimit: 2400 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
