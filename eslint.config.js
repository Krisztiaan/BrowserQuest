import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const baseRules = {
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

const esmClientRules = {
  ...baseRules,
  'no-undef': 'error',
};

const serverRuntimeRules = {
  ...baseRules,
  'no-undef': 'error',
};

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'client/js-esm/lib/**',
      'server/js/lib/**',
    ],
  },
  {
    files: ['server/js/**/*.js', 'shared/js/**/*.js', 'tools/maps/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: serverRuntimeRules,
  },
  {
    files: ['client/js-esm/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: esmClientRules,
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2024,
        Bun: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...baseRules,
    },
  },
];
