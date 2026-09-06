import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  optimizeDeps: {
    exclude: ["@gaulatti/bleecker"],
  },
  server: {
    allowedHosts: ["kolibri.dev"],
  },
  ssr: {
    noExternal: ["@gaulatti/bleecker"],
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
