/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: vite.config.ts
 * Description:
 *   Configuration for Vite build
 */
/// <reference types="vitest" />

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';

// vite does not shim the global object and we need it for dev but
// not for the production build
const global = process.env.NODE_ENV === 'development' ? 'window' : 'global';

const config: any = {
  base: '/',
  build: {
    outDir: 'build',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true, // to be removed later @TODO RG
  },
  preview: {
    port: 3000,
    host: true,
  },
  resolve: {
    alias: {
      events: 'rollup-plugin-node-polyfills/polyfills/events',
    },
    preserveSymlinks: true,
  },
  plugins: [react({jsxImportSource: '@emotion/react'})],
  define: {
    global: global,
    'process.env': {} /* some libraries check this */,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [],
    },
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
