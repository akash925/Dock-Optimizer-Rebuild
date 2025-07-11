// eslint.config.js  – Flat-config style
// -------------------------------------------------

import js             from '@eslint/js';                       // ESLint core rules (recommended)
import tseslint        from '@typescript-eslint/eslint-plugin'; // TypeScript rules
import tsParser        from '@typescript-eslint/parser';        // TypeScript parser
import jestPlugin      from 'eslint-plugin-jest';               // Jest rules
import globals         from 'globals';                          // map of standard globals
import React from 'react';

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
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },

      /* globals -------------------------------------------------- */
      globals: {
        /* standard envs */
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.es2020,

        /* extras you referenced explicitly */
        URLSearchParams: 'readonly',
        FormData:        'readonly',
        File:            'readonly',
        Blob:            'readonly',
        React:            'readonly',   // until you migrate to the new JSX transform
        Headers:          'readonly',
        HTMLInputElement: 'readonly',
        HTMLElement:      'readonly',
        SVGSVGElement:    'readonly',
        MediaStream:      'readonly',
        MediaDeviceInfo:  'readonly',
        MutationObserver: 'readonly',
        EventListener:    'readonly',
        XMLSerializer:    'readonly',
        FileReader:       'readonly',
        Image:            'readonly',
        navigator:        'readonly',
        btoa:             'readonly',
        JSX:              'readonly',
      },
    },

    /* plugins ---------------------------------------------------- */
    plugins: {
      '@typescript-eslint': tseslint,
      jest:                 jestPlugin,
    },

    /* rules ------------------------------------------------------ */
    rules: {
      // "process" guard-rail for client code
      'no-restricted-globals': [
        'error',
        {
          name:    'process',
          message: 'Use import.meta.env.VITE_* instead of `process` in client code.',
        },
      ],

      // TypeScript-specific tweaks
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Soften a few noisy JS rules during migration
      'no-unused-vars': 'off', // Use TypeScript version instead
      'no-redeclare':          'warn',
      'no-dupe-class-members': 'warn',
      'no-useless-escape':     'warn',
    },
  },

  // 3) Server-only overrides (allow unrestricted `process`, etc.)
  {
    files: [
      'server/**/*',
      'scripts/**/*',
      'tools/**/*',
      'vitest.setup.ts',
      'vitest.config.ts',
      'cypress.config.ts',
      '**/*.config.*',
      '**/*.setup.*',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
        /* TS / Node types */
        NodeJS: 'readonly',
      },
    },

    rules: {
      'no-restricted-globals': 'off', // Allow process.env in server code
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
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
