// SPDX-License-Identifier: Apache-2.0
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

/**
 * Load package `.env.dist` into `process.env` for keys that are not already
 * set, so `parseApiEnv` has required Conductor/Couch values in unit tests.
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
  test: {
    env: distEnv,
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 15_000,
    // Shared in-memory PouchDB / Express app singletons are not isolation-safe
    // across parallel workers. Keep Mocha's single-process sequential behaviour.
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    hookTimeout: 30_000,
    server: {
      deps: {
        // Keep Express on Node's require cache so patchExpressAsync and
        // expressSetup share the same Layer prototype (async error forwarding).
        external: ['express'],
      },
    },
  },
});
