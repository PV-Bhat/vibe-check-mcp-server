import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['**/alt-test*.js', 'test-client.*', 'src/tools/vibeDistil.ts', 'src/tools/vibeLearn.ts'],
      thresholds: { lines: 80 }
    }
  }
});
