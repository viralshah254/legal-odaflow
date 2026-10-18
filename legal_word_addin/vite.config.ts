import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const require = createRequire(import.meta.url);
const devCerts = require("office-addin-dev-certs") as {
  getHttpsServerOptions: () => Promise<{
    key: Buffer;
    cert: Buffer;
    ca?: Buffer;
  }>;
};

export default defineConfig(async () => {
  const httpsOptions = await devCerts.getHttpsServerOptions();

  return {
    plugins: [
      react(),
      viteSingleFile(),
      {
        name: "patch-office-html",
        closeBundle() {
          execSync("node scripts/patch-office-html.mjs", { stdio: "inherit" });
        },
      },
    ],
    base: "./",
    build: {
      target: "es2015",
      outDir: "dist",
      cssCodeSplit: false,
      modulePreload: false,
      rollupOptions: {
        input: {
          taskpane: "src/taskpane/index.html",
        },
        output: {
          inlineDynamicImports: true,
          format: "iife",
          name: "UmbrellaAddin",
          entryFileNames: "assets/[name].js",
        },
      },
    },
    preview: {
      port: 3001,
      strictPort: true,
      https: httpsOptions,
      cors: true,
      host: "localhost",
    },
  };
});
