/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Fuseau épinglé sur celui de l'utilisation réelle. Le défaut de lecture
    // des dates corrigé le 11/08/2026 (décalage J-1 sur 100 % des lignes) ne
    // se manifeste QUE dans un fuseau à décalage positif : sous TZ=UTC, les
    // trois tests de `parseExcel.worker.test.ts` passaient même avec le code
    // fautif. Sans cette ligne, ils ne sont qu'un décor sur une machine d'CI.
    env: { TZ: "Europe/Paris" },
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/hooks/**", "src/components/ui/**"],
    },
  },
});
