import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "~", replacement: fileURLToPath(new URL("./app", import.meta.url)) },
      { find: "../core.js", replacement: "@gaulatti/bleecker/core" },
    ],
  },
  test: {
    server: { deps: { inline: [/@gaulatti\/bleecker/] } },
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://kolibri.example" } },
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      reporter: ["json", "json-summary", "text"],
      reportOnFailure: true,
      thresholds: { lines: 100, branches: 100 },
    },
  },
});
