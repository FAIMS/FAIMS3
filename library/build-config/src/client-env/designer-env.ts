// SPDX-License-Identifier: Apache-2.0
/**
 * Layer 2 — designer-only ENV schema (consumed by the Control Centre designer).
 * Both flags are optional with safe defaults.
 */
import {z} from 'zod';
import {boolWithDefault} from '../env-coercion.js';

/** Designer flags produced by {@link parseDesignerEnv}. */
export type DesignerRuntimeConfig = {
  /** When true, lock fields that templates mark as protected. */
  templateProtections: boolean;
  /** Allow adding a plan on templates that do not already have one. */
  enablePlansInDesigner: boolean;
};

export const DesignerEnvSchema = z
  .object({
    VITE_TEMPLATE_PROTECTIONS: boolWithDefault(false),
    VITE_ENABLE_PLANS_IN_DESIGNER: boolWithDefault(true),
  })
  .strip();

export type DesignerEnv = z.infer<typeof DesignerEnvSchema>;

/**
 * Parse designer-only Vite flags. Both keys are optional with safe defaults.
 */
export function parseDesignerEnv(
  raw: Record<string, unknown>
): DesignerRuntimeConfig {
  const env = DesignerEnvSchema.parse(raw);
  return {
    templateProtections: env.VITE_TEMPLATE_PROTECTIONS,
    enablePlansInDesigner: env.VITE_ENABLE_PLANS_IN_DESIGNER,
  };
}
