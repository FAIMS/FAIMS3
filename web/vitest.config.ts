import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // This is the key setting
    globals: true,
    browser: {
      enabled: true,
      headless: true,
      name: 'chrome',
    },
  },
});
