// SPDX-License-Identifier: Apache-2.0

import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      events: 'rollup-plugin-node-polyfills/polyfills/events',
    },
    preserveSymlinks: false,
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    reporters: ['verbose'],
    // Only TS or TSX files
    include: ['**/*.{test,spec}.ts?(x)'],
    exclude: ['dist/*', 'node_modules', 'build', '.turbo'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*'],
      exclude: [],
    },
  },
});
