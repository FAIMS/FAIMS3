// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: vitest.config.ts
 * Description:
 *   Configuration for Vitest testing
 */

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
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    reporters: ['verbose'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [],
    },
  },
});
