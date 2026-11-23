import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // Hard rule (SPEC §2): logs must not carry request content; route all logging through src/log.ts.
      'no-console': 'error',
    },
  },
  {
    files: ['src/log.ts', 'src/refresh/**', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
