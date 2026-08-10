import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

// Native flat config (ESLint 9). `eslint-config-next` v16's flat export is
// incompatible with the installed ESLint 9 flat loader (circular-ref crash on
// `next.configs.flat`), so we wire a minimal TypeScript + JS setup directly.
// This is the working config tracked in issue #7.
export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      // Browser + Node globals for a Next.js (client) + socket server (node) app.
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TS already reports genuinely-unowned identifiers via type-check; keep
      // `no-undef` off so DOM/Node globals (document, process, etc.) aren't flagged.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'server.js', 'lib/socket.js'],
  },
];
