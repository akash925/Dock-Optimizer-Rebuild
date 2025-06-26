// eslint.config.js  – Flat-config style
// -------------------------------------------------

import js             from '@eslint/js';                       // ESLint core rules (recommended)
import tseslint        from '@typescript-eslint/eslint-plugin'; // TypeScript rules
import tsParser        from '@typescript-eslint/parser';        // TypeScript parser
import jestPlugin      from 'eslint-plugin-jest';               // Jest rules
import globals         from 'globals';                          // map of standard globals

export default [
  // 1) ESLint recommended (JS only)
  js.configs.recommended,

  // 2) Base rules that apply everywhere (client + server)
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],

    /* syntax / parser ------------------------------------------- */
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },

      /* globals -------------------------------------------------- */
      globals: {
        /* standard envs */
        ...globals.browser,
        ...globals.node,
        ...globals.jest,

        /* extras you referenced explicitly */
        URLSearchParams: 'readonly',
        FormData:        'readonly',
        File:            'readonly',
        Blob:            'readonly',
      },
    },

    /* plugins ---------------------------------------------------- */
    plugins: {
      '@typescript-eslint': tseslint,
      jest:                 jestPlugin,
    },

    /* rules ------------------------------------------------------ */
    rules: {
      // “process” guard-rail for client code
      'no-restricted-globals': [
        'error',
        {
          name:    'process',
          message: 'Use import.meta.env.VITE_* instead of `process` in client code.',
        },
      ],

      // TypeScript-specific tweaks
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Soften a few noisy JS rules during migration
      'no-unused-vars':        'warn',
      'no-redeclare':          'warn',
      'no-dupe-class-members': 'warn',
      'no-useless-escape':     'warn',
    },
  },

  // 3) Server-only overrides (allow unrestricted `process`, etc.)
  {
    files: [
      'server/**/*.{js,mjs,cjs,ts,tsx}',
      'scripts/**/*.{js,mjs,cjs,ts,tsx}',
      'vite.config.ts',
      'drizzle.config.ts',
      '*.config.{js,mjs,cjs,ts}',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
        /* TS / Node types */
        NodeJS: 'readonly',
      },
    },

    rules: {
      'no-restricted-globals': 'off', // “process” is fine on the server
    },
  },

  // 4) Shared code that runs in both contexts
  {
    files: ['shared/**/*.{js,mjs,cjs,ts,tsx}'],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      'no-restricted-globals': 'off',
    },
  },
];
