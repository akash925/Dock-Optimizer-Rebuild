import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '~': path.resolve(__dirname, 'server/src')
    }
  },
  define: {
    'process.env.VITEST': 'true'
  }
});