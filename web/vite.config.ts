import path from 'path';
import react from '@vitejs/plugin-react-swc';
import {defineConfig} from 'vite';
import {tanstackRouter} from '@tanstack/router-plugin/vite';

export default defineConfig({
  // Just a hack to get this to typecheck - works fine??
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeTreeFileHeader: [
        '// SPDX-License-Identifier: Apache-2.0',
        '/* eslint-disable */',
        '// @ts-nocheck',
        '// noinspection JSUnusedGlobalSymbols',
      ],
    }),
    react(),
  ],
  resolve: {
    alias: {'@': path.resolve(__dirname, './src')},
    dedupe: ['@mui/material', '@emotion/react', '@emotion/styled'],
  },
  server: {
    port: 3001,
    host: true,
    fs: {allow: ['..']},
  },
  // Same port when serving the build, so CI and the dev stack agree.
  preview: {
    port: 3001,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/react/jsx-runtime',
    ],
    exclude: [],
  },
  // Polyfill global in case of weird importing going on!
  define: {
    global: 'globalThis',
    // Replace __APP_VERSION__ with package.json version at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
