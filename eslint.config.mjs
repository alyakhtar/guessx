import next from 'eslint-config-next';

export default [
  ...next.configs.flat.recommended,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
    ],
  },
];
