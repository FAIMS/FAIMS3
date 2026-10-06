// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration for the designer (template
 *   protections and plan-authoring flags). Configuration is parsed from Vite's
 *   `import.meta.env` with a single zod schema (coerce + rename) and exposed
 *   via the `config` singleton. Document env keys on the schema; the transform
 *   is rename-only.
 */

import {configHelpers} from '@faims3/data-model';
import {z} from 'zod';

const EnvSchema = z
  .object({
    /**
     * Enables template edit protections in the designer. Defaults to false
     * when unset.
     */
    VITE_TEMPLATE_PROTECTIONS: configHelpers.truthyBool(false),
    /**
     * Enables adding a plan in the designer for templates that do not already
     * have one. Defaults to true. When false, existing plans can still be
     * reconfigured.
     */
    VITE_ENABLE_PLANS_IN_DESIGNER: configHelpers.boolWithDefault(true),
  })
  .strip()
  .transform(({VITE_TEMPLATE_PROTECTIONS, VITE_ENABLE_PLANS_IN_DESIGNER}) => ({
    /** Whether template protections are enabled. */
    templateProtections: VITE_TEMPLATE_PROTECTIONS,
    /** Whether the designer can add a plan to templates without one. */
    enablePlansInDesigner: VITE_ENABLE_PLANS_IN_DESIGNER,
  }));

/**
 * The singleton designer configuration object. Prefer reading values from here.
 *
 * Pass the whole `import.meta.env` — `.strip()` drops undeclared keys.
 */
export const config = EnvSchema.parse(import.meta.env);

export type DesignerConfig = typeof config;
