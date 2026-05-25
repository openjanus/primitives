import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Longer timeout for ZK proof generation (transfer circuit ~2s)
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // Run tests sequentially — Poseidon singleton is shared
    sequence: {
      concurrent: false,
    },
    // Coverage settings
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
    },
    environment: "node",
  },
  resolve: {
    extensionOrder: [".ts", ".js"],
  },
});
