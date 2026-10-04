import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Test settings: a separate database and cheap bcrypt rounds. Already-set variables (CI) win.
config({ path: new URL('./.env.test', import.meta.url), quiet: true });

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entry points and the dev-only web server are covered by the end-to-end checks instead.
      exclude: ['src/generated/**', 'src/server.ts', 'src/start.ts', 'src/web.ts'],
      reporter: ['text-summary', 'html'],
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/*.test.ts'],
          globalSetup: ['tests/globalSetup.ts'],
          setupFiles: ['tests/setup.ts'],
          // Every file uses the same database, so files run one at a time.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
