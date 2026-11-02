import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Most tests are pure functions, and creating a jsdom per file was ~90% of
    // the run time. A test that renders into the DOM opts in with a
    // `// @vitest-environment jsdom` comment at the top of its file.
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'tools/*.test.mjs'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/common/**/*.ts']
    }
  }
});
