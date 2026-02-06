import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    define: {
      global: 'globalThis',
      // Replace __APP_VERSION__ with package.json version at build time
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    // browser config updated for Vitest 2.x
    browser: {
      enabled: true,
      headless: true,
      provider: 'webdriverio', // or 'playwright'
      instances: [
        {
          browser: 'chrome',
        },
      ],
    },
  },
});
