import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'tests/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // === Целевое правило проекта ===
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // === Смягчение рекомендованных правил (пред-существующий код) ===
      'no-useless-catch': 'warn',
      'preserve-caught-error': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/db/migrations/**'],
    rules: {
      'no-console': 'off',
    },
  }
);
