import js from '@eslint/js';
import globals from 'globals';

// Config plana (ESLint 9+). Objetivo: cazar errores reales (variables no
// definidas, imports rotos) sin convertirse en un linter de estilo. El CI usa
// esto como gate junto con los tests.
export default [
  {
    ignores: ['node_modules/**', 'src/generated/**', 'coverage/**', 'src/uploads/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // No queremos que variables sin usar tumben el build; sí marcar las de error.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^(req|res|next)$', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
];
