// Reglas de lint del proyecto: errores reales (variables sin uso, hooks de React mal usados, etc.), sin reglas de estilo.
// Se ejecuta con `npm run lint`.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';

const sinUso = ['warn', { argsIgnorePattern: '^_' }];

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'frontend/playwright-report/**', 'frontend/test-results/**'] },
  {
    files: ['backend/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': sinUso },
  },
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': hooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18' } },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...hooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': sinUso,
    },
  },
  {
    // Configuración y pruebas de extremo a extremo del frontend: corren en Node
    files: ['frontend/e2e/**/*.js', 'frontend/*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': sinUso },
  },
];
