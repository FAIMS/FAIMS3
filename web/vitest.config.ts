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
    alias: {'@': path.resolve(__dirname, './src')},
    dedupe: ['@mui/material', '@emotion/react', '@emotion/styled'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
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
