import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/private/ is git-ignored and may be absent; vitest simply finds no files there then.
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
  },
});
