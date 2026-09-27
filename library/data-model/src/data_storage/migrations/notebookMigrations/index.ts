/**
 * @file Notebook JSON schema migration harness.
 *
 * - `types.ts`     — step contract, legacy sentinel, error type
 * - `registry.ts`  — `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION` + registered steps
 * - `identify.ts`  — path finder (`from` → target)
 * - `runner.ts`    — `migrateNotebook` (apply migrate + validate per step)
 * - `steps/`       — one module per step; `legacyToV1.ts` collapses the
 *                    deprecated pre-semver ladder (not exported from here)
 */

export * from './types';
export * from './version';
export * from './registry';
export * from './identify';
export * from './runner';
