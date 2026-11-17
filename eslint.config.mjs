import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const unusedVarsRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    ignoreRestSiblings: true,
  },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-unused-vars': unusedVarsRule,
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['backend/tests/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ['frontend/src/**/*.{js,jsx}', 'frontend/tests/**/*.{js,jsx}', 'frontend/e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      eqeqeq: ['error', 'always'],
      'no-unused-vars': unusedVarsRule,
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['frontend/tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
