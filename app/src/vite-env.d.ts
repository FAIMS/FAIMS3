// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: vite-env.d.ts
 * Description:
 *   Vite types
 */

/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** When true, manual notebook deactivation destroys local Pouch/IndexedDB; optional, default false */
  readonly VITE_DELETE_ON_DEACTIVATION?: string;
}
