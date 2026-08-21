import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/taskmanager_test",
      SESSION_SECRET: "test-secret",
    },
    setupFiles: ["./tests/setup.js"],
    fileParallelism: false,
  },
});
