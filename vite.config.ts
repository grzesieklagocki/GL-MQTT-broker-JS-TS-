import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@mqtt": path.resolve(__dirname, "./src/mqtt"),
    },
  },
  test: {
    globals: true,
  },
});
