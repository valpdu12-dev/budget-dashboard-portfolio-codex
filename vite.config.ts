import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Les chemins relatifs rendent le build prévisualisable depuis n'importe
  // quel sous-dossier d'un hébergement statique.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(?:react|react-dom|react-router|react-router-dom)\//.test(id)) return "react";
          if (id.includes("node_modules/recharts/")) return "charts";
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
