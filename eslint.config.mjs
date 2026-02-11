import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

// ──────────────────────────────────────────────
// Shared base rules (all file types)
// ──────────────────────────────────────────────
const baseRules = {
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'no-constant-condition': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-extra-boolean-cast': 'error',
    'no-func-assign': 'error',
    'no-inner-declarations': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-obj-calls': 'error',
    'no-sparse-arrays': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-caller': 'error',
    'no-eval': 'error',
    'no-new-wrappers': 'error',
    'no-with': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
};

// ──────────────────────────────────────────────
// TypeScript type-aware rules
// ──────────────────────────────────────────────
const tsStrictRules = {
    ...baseRules,

    // Disable base rules superseded by TS equivalents
    'no-unused-vars': 'off',
    'no-undef': 'off', // strict TS covers this

    // ── Core TS rules ──
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
        },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: false }],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-duplicate-type-constituents': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-empty-object-type': 'error',
    '@typescript-eslint/no-wrapper-object-types': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'error',

    // ── Type-aware rules (require project) ──
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/restrict-template-expressions': ['warn', { allowNumber: true, allowBoolean: true }],
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-redundant-type-constituents': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
    '@typescript-eslint/prefer-promise-reject-errors': 'warn',
    '@typescript-eslint/no-base-to-string': 'warn',
    '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
    '@typescript-eslint/only-throw-error': 'error',
    '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    '@typescript-eslint/no-confusing-void-expression': ['warn', { ignoreArrowShorthand: true }],
};

// Client-specific TS additions
const clientTsRules = {
    ...tsStrictRules,
    'no-restricted-imports': [
        'error',
        {
            paths: [
                {
                    name: 'jquery',
                    message: 'Modern client runtime must remain jQuery-free.',
                },
            ],
        },
    ],
    'no-restricted-globals': [
        'error',
        {
            name: '$',
            message: 'Modern client runtime must not use jQuery-style global "$".',
        },
    ],
};

// Server runtime rules (plain JS files)
const serverRuntimeRules = {
    ...baseRules,
    'no-undef': 'error',
};

export default [
    // ── Global config ──
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
    },
    {
        ignores: ['node_modules/**', 'dist/**', 'client/js-esm/lib/**', 'server/js/lib/**'],
    },

    // ── Server / shared JS (CJS) ──
    {
        files: ['server/js/**/*.js', 'shared/js/**/*.js'],
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

    // ── Client JS (ESM, non-TS) ──
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
        rules: {
            ...baseRules,
            'no-undef': 'error',
        },
    },

    // ── Client TS (type-aware) ──
    {
        files: ['server/js/**/*.ts', 'shared/js/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                ...globals.es2024,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: tsStrictRules,
    },

    // ── Client TS (type-aware) ──
    {
        files: ['client/js-esm/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
                ...globals.es2024,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: clientTsRules,
    },

    // ── Tests TS (type-aware) ──
    {
        files: ['tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
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
        rules: tsStrictRules,
    },
];
