import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: {
    exclude: ["@gaulatti/bleecker"],
  },
  resolve: {
    alias: [
      {
        find: "../core.js",
        replacement: "@gaulatti/bleecker/core",
      },
    ],
    tsconfigPaths: true,
  },
});
