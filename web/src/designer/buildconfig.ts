// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the designer configuration (template protections and
 *   plan-authoring flags). The values are parsed from Vite's `import.meta.env`
 *   by the shared @faims3/build-config module (the single source of truth for
 *   the config chain) and exposed via the `config` singleton.
 */

import {parseGeneratedEnv} from '@faims3/build-config';

const canonical = parseGeneratedEnv(import.meta.env);

/**
 * The singleton designer configuration object. Prefer reading values from here.
 */
export const config = {
  /** Whether template protections are enabled. */
  templateProtections: canonical.webDesignerLimits.templateProtections,
  /** Whether the designer can add a plan to templates without one. */
  enablePlansInDesigner: canonical.webDesignerLimits.enablePlansInDesigner,
};

export type DesignerConfig = typeof config;
