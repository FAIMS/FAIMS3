import {defineConfig} from 'vitest/config';
import {webdriverio} from '@vitest/browser-webdriverio';
import path from 'path';

export default defineConfig({
  define: {
    global: 'globalThis',
    // Replace __APP_VERSION__ with package.json version at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Same pinning as vite.config: one copy so Facet/Compartment instanceof matches.
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // One @codemirror/state instance so history() Facets pass instanceof.
    server: {
      deps: {
        inline: [
          '@codemirror/commands',
          '@codemirror/state',
          '@codemirror/view',
        ],
      },
    },
    browser: {
      enabled: true,
      headless: true,
      provider: webdriverio(),
      instances: [
        {
          browser: 'chrome',
        },
      ],
    },
  },
});
