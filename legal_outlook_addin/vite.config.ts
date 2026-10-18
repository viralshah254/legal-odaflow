import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        readpane: "src/taskpane/read.html",
        composepane: "src/taskpane/compose.html",
      },
    },
  },
  server: {
    port: 3002,
    https: {
      // For Office.js development, HTTPS is required
      // Use office-addin-dev-certs to generate certs
    },
  },
});
