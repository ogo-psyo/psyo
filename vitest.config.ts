import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['scripts/qa/vitest/**/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
