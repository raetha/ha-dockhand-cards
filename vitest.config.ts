import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Most tests are pure functions, and creating a jsdom per file was ~90% of
    // the run time. A test that renders into the DOM opts in with a
    // `// @vitest-environment jsdom` comment at the top of its file.
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'scripts/*.test.mjs'],
    // `npm test` checks these floors (verify, and so CI, runs it). They sit
    // just under today's coverage so it can only go up: raise them when
    // tests are added, never lower them to let a change through.
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-setup.ts'],
      thresholds: { lines: 71, statements: 69, branches: 64, functions: 64 }
    }
  }
});
