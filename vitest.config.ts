import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '~': path.resolve(__dirname, 'server/src')
    }
  }
});