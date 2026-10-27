// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: vitest.config.ts
 * Description:
 *   Configuration for Vitest testing
 */

import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

/**
 * Load package `.env.dist` into `process.env` for keys that are not already
 * set, so `parseAppEnv(import.meta.env)` has required VITE_* values in tests.
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
  plugins: [],
  resolve: {
    alias: {
      events: 'rollup-plugin-node-polyfills/polyfills/events',
    },
    preserveSymlinks: false,
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  test: {
    env: distEnv,
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    reporters: ['verbose'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: [],
    },
  },
});
