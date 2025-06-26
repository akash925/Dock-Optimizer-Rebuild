import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      env: {
        browser: true,   // window, document, navigator, …
        node: true,      // __dirname, process, global, …
        jest: true       // describe, test, expect, beforeAll, …
        },
      globals: {
        // Browser globals for client code
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // Test globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Guard rail to prevent process usage in client code
      'no-undef': 'off',
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Do NOT use `process` in client code – use import.meta.env.VITE_* instead. For server-side code, this restriction is overridden.',
        },
      ],
      // Warn about unused variables but don't error
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Allow any type temporarily to avoid blocking migration
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable some noisy rules temporarily
      'no-unused-vars': 'warn',
      'no-redeclare': 'warn',
      'no-dupe-class-members': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  {
    // Override for server-side files - allow process usage
    files: [
      'server/**/*.{js,mjs,cjs,ts,tsx}',
      'scripts/**/*.{js,mjs,cjs,ts,tsx}',
      'vite.config.ts',
      'drizzle.config.ts',
      '*.config.{js,mjs,cjs,ts}',
    ],
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        // Test globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        // TypeScript/Node types
        NodeJS: 'readonly',
      },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    // Override for shared files - allow process usage since they run in both contexts
    files: ['shared/**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        // Both browser and Node.js globals since shared code runs in both
        process: 'readonly',
        window: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },
]; 