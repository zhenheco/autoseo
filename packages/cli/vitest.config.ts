import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../web/src"),
      "@audit": path.resolve(__dirname, "../audit/src/index.ts"),
      "@shared/supabase": path.resolve(
        __dirname,
        "../shared/src/supabase/index.ts",
      ),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
