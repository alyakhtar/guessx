import cwv from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';

// Real Next.js 16 flat config (Core Web Vitals + TypeScript). These subpath
// exports load correctly as flat-config arrays under ESLint 9 and bring in the
// Next.js, React, and React Hooks rules. Resolves review finding: the previous
// hand-rolled config dropped those framework rules and disabled no-undef.
const nextConfig = [
  ...ts,
  ...cwv,
  {
    // server/socket-server.js is a CommonJS Node entrypoint that uses require()
    // and is not covered by tsconfig's type-checking. Allow require there and
    // keep no-undef off (Node globals), while the Next/React rules stay active
    // for the rest of the app.
    files: ['server/**/*.js'],
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
