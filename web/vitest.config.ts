import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {
    global: 'globalThis',
    // Replace __APP_VERSION__ with package.json version at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
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
