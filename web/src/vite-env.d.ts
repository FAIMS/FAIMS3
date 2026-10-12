// SPDX-License-Identifier: Apache-2.0
/// <reference types="vite/client" />

// Vite define replacements
declare const __APP_VERSION__: string;

/**
 * All runtime configuration is read from `@faims3/build-config`
 * (see ./constants.ts), which parses the generated `VITE_*` env. This file no
 * longer declares individual `VITE_*` keys — the shared module is the single
 * source of truth for which keys exist and how they are coerced.
 */
