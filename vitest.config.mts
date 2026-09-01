import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/qa/route-characterization.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    restoreMocks: true,
    unstubEnvs: true,
  },
});
