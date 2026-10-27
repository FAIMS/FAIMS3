// SPDX-License-Identifier: Apache-2.0
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';
import {webdriverio} from '@vitest/browser-webdriverio';
import path from 'path';

/**
 * Load package `.env.dist` into `process.env` for keys that are not already
 * set, so `parseWebEnv` / `parseDesignerEnv` have required VITE_* values in tests.
 */
function loadEnvDistIfUnset(dir: string): Record<string, string> {
  const loaded: Record<string, string> = {};
  const file = resolve(dir, '.env.dist');
  if (!existsSync(file)) return loaded;
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    loaded[key] = value;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return loaded;
}

const distEnv = loadEnvDistIfUnset(process.cwd());

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
    env: distEnv,
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
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
