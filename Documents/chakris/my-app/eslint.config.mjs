import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new globalThis.URL('.', import.meta.url))

export default [
  js.configs.recommended,
  {
    ignores: ['dist', 'node_modules', '.wrangler'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
        URL: 'readonly',
        TextEncoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        KeyUsage: 'readonly',
        React: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        KVNamespace: 'readonly',
        D1Database: 'readonly',
        DurableObject: 'readonly',
        DurableObjectState: 'readonly',
        DurableObjectNamespace: 'readonly',
        Fetcher: 'readonly',
        WebSocket: 'readonly',
        WebSocketPair: 'readonly',
      },
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: rootDir,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
      },
    },
  },
]
