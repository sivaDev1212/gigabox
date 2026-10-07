import { defineConfig } from 'vitest/config';

const testDatabaseUrl = 'postgresql://gigabox:gigabox@localhost:5432/gigabox_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      CORS_ORIGIN: 'http://localhost:5173',
      ORDER_RATE_LIMIT_WINDOW_MS: '60000',
      ORDER_RATE_LIMIT_MAX: '10000',
      REDIS_URL: '',
      AUTO_CANCEL_MINUTES: '5',
    },
  },
});
