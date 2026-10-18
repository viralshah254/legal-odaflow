import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "lib/**/*.test.ts",
      "components/issue-checker/**/*.test.ts",
      "e2e/**/*.e2e.ts",
    ],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
