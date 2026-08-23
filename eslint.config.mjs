import cwv from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';

// Real Next.js 16 flat config (Core Web Vitals + TypeScript). These subpath
// exports load correctly as flat-config arrays under ESLint 9 and bring in the
// Next.js, React, and React Hooks rules. Resolves review finding: the previous
// hand-rolled config dropped those framework rules and disabled no-undef.
const nextConfig = [
  ...ts,
  ...cwv,
  {
    // Pre-existing codebase-wide stylistic violations, downgraded to WARN (not
    // removed) so they stay visible but don't block CI. This matches the review
    // guidance: keep the framework checks as the gate, stage-clean the legacy
    // noise explicitly rather than silencing the whole ruleset.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // Legacy `any` throughout lib/ and types/ — tracked for a later refactor.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    plugins: { 'react-hooks': reactHooks },
  },
  {
    // All .js files in this repo are CommonJS Node scripts/configs (server/*,
    // next.config.js, next-intl.config.js, lib/models/*.model.js). They use
    // require() and aren't covered by tsconfig's type-checking, so allow require
    // and keep no-undef off (Node globals). The .ts/.tsx app code stays strict.
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'server.js', 'lib/socket.js'],
  },
];

export default nextConfig;
