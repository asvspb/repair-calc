import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'temp/**',
      'coverage/**',
      'tests/**',
      '*.config.*',
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
      'no-useless-assignment': 'warn',
      'no-dupe-else-if': 'warn',
      'no-prototype-builtins': 'warn',
      'preserve-caught-error': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }
);
