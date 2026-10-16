const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'dist-*/**', 'sites/**/dist/**', '.sdk-inspection/**', 'reports/**', 'scripts/product-art/**'] },
]);
