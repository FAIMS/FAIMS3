// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   Designer configuration (template protections and plan-authoring flags),
 *   parsed from Vite's `import.meta.env` by `@faims3/build-config`.
 */

import {parseDesignerEnv} from '@faims3/build-config';

/**
 * The singleton designer configuration object. Prefer reading values from here.
 */
export const config = parseDesignerEnv(import.meta.env);

export type DesignerConfig = typeof config;
