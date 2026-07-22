import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      // Flat config's eslint:recommended flags undefined globals as
      // no-undef even for TS-only constructs the TS compiler itself
      // already checks (and does so more accurately) — same reasoning
      // typescript-eslint's own flat config docs give for disabling this.
      'no-undef': 'off'
    }
  },
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**']
  }
];
