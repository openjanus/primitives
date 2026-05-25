import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use longer timeout for BSGS table builds and crypto operations
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Run tests sequentially within a file (BSGS state is global)
    sequence: {
      concurrent: false,
    },
    // Coverage settings
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/vectors.ts"],
    },
    // Environment: Node (for crypto, fs)
    environment: "node",
  },
  resolve: {
    // Support .js extensions in imports (ESM)
    extensionOrder: [".ts", ".js"],
  },
});
