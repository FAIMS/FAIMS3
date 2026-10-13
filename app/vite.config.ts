// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: vite.config.ts
 * Description:
 *   Configuration for Vite build
 */

/// <reference types="vitest" />

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';

const config: any = {
  base: '/',
  build: {
    outDir: 'build',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  resolve: {
    alias: {
      events: 'rollup-plugin-node-polyfills/polyfills/events',
    },
    preserveSymlinks: false,
  },
  plugins: [react({jsxImportSource: '@emotion/react'})],
  define: {
    global: 'globalThis',
    'process.env': {} /* some libraries check this */,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  optimizeDeps: {
    exclude: ['@ionic/pwa-elements'],
  },
};

// Conditional configuration.  If run with --mode sourcemap
// we will build with sourcemaps enabled and output to a different directory.
export default defineConfig(({mode}) => {
  if (mode === 'sourcemap') {
    config.build.sourcemap = true;
    config.build.outDir = 'build-sourcemap';
    return config;
  } else {
    return config;
  }
});
