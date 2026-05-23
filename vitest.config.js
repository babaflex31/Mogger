// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // optionally, clear mocks between tests
    restoreMocks: true,
    // show full diff for assertions
    diff: true
  }
});
