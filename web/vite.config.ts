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
    alias: {
      '@': path.resolve(__dirname, './src'),
      // One physical copy so Facet/Compartment instances match EditorState.
      '@codemirror/state': path.resolve(
        __dirname,
        'node_modules/@codemirror/state'
      ),
      '@codemirror/view': path.resolve(
        __dirname,
        'node_modules/@codemirror/view'
      ),
    },
    dedupe: [
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
    ],
  },
  server: {
    port: 3001,
    host: true,
    fs: {allow: ['..']},
  },
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/react/jsx-runtime',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
    ],
    exclude: [],
  },
  ssr: {
    noExternal: [
      '@codemirror/commands',
      '@codemirror/state',
      '@codemirror/view',
    ],
  },
  // Polyfill global in case of weird importing going on!
  define: {
    global: 'globalThis',
    // Replace __APP_VERSION__ with package.json version at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
