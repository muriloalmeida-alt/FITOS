import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: loadEnv(mode, import.meta.dirname, ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // O Next.js resolve "server-only" para um módulo vazio via a condição
      // de export "react-server" ao empacotar Server Components; fora do
      // bundler do Next.js (aqui, no Vitest), o pacote lança erro em
      // qualquer import. Aponta para o próprio "empty.js" que o pacote já
      // publica para esse fim — mesmo no-op que o Next.js usa.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
}));
