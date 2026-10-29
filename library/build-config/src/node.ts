// SPDX-License-Identifier: Apache-2.0
/**
 * Node-only helpers for `@faims3/build-config/node`.
 *
 * Kept off the root browser entry point so `node:fs` / `node:path` are never
 * pulled into Vite browser bundles.
 */
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

/**
 * Load a package's `.env.dist` into `process.env` for keys that are not
 * already set, and return the parsed key/value map (for e.g. Vitest's
 * `test.env`).
 */
export function loadEnvDistIfUnset(dir: string): Record<string, string> {
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
