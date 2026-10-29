// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: vitest.config.ts
 * Description:
 *   Configuration for Vitest testing
 */

import {loadEnvDistIfUnset} from '@faims3/build-config/node';
import {defineConfig} from 'vitest/config';

const distEnv = loadEnvDistIfUnset(process.cwd());

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
    env: distEnv,
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
