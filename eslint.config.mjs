// ESLint flat config (no Next wrapper) + SSR/browser-APIs guidance
// Switches away from eslint-config-next to avoid @rushstack/eslint-patch errors.

import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'dist/**', 'build/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      next: nextPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React basics
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript recommendations (minimal)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // SSR/browser guidance
      'no-restricted-globals': ['warn', 'window', 'document'],
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Program > ExpressionStatement[expression.type='MemberExpression'][expression.object.name='window']",
          message: 'Avoid window at module scope; move into guarded function or client component.',
        },
        {
          selector: "Program > ExpressionStatement[expression.type='MemberExpression'][expression.object.name='document']",
          message: 'Avoid document at module scope; move into guarded function or client component.',
        },
      ],

      // Disable Next-specific rule since we intentionally use <img> in places
      'next/no-img-element': 'off',
    },
  },
]
