import {defineConfig} from 'vitest/config';

export default defineConfig({
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
