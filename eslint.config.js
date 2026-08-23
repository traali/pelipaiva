export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'screenshots/**', 'test-results/**', 'playwright-report/**']
  },
  {
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  }
];
