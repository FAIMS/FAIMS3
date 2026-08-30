import z from 'zod';
import {
  PlanSchema,
  PlanTemplateSchema,
  type AnyPlanTypeDefinition,
} from './types';

export const COUNTED_PLAN_TYPE = 'Counted' as const;

// Counted plan asks for some number of a specific form
// The template defines which form from the notebook is required,
// and defines a configuration 'form' that will be filled in when the notebook
// is instantiated.

export const countedPlanTemplateConfigSchema = z.object({
  numberRequired: z.number().int().positive(),
  allowExtraRecords: z.boolean(),
});
export type CountedPlanTemplateConfig = z.infer<
  typeof countedPlanTemplateConfigSchema
>;

export const countedPlanTemplateSchema = PlanTemplateSchema.extend({
  planType: z.literal(COUNTED_PLAN_TYPE),
  formType: z.string(),
});
export type CountedPlanTemplate = z.infer<typeof countedPlanTemplateSchema>;

export const countedPlanSchema = PlanSchema.extend({
  planType: z.literal(COUNTED_PLAN_TYPE),
  formType: z.string(),
  numberRequired: z.number().int().positive(),
  allowExtraRecords: z.boolean(),
});
export type CountedPlan = z.infer<typeof countedPlanSchema>;

/**
 * Create a counted plan from a counted plan template.
 *
 * @param template A Counted Plan template
 * @param config A Counted Plan configuration
 */
export const instantiateCountedPlan = ({
  template,
  config,
}: {
  template: CountedPlanTemplate;
  config: CountedPlanTemplateConfig;
}): Omit<CountedPlan, 'planId' | 'label'> => {
  if (!countedPlanTemplateSchema.safeParse(template).success) {
    throw new Error('Invalid counted plan template');
  }
  return {
    planType: template.planType,
    formType: template.formType,
    numberRequired: config.numberRequired,
    allowExtraRecords: config.allowExtraRecords,
  };
};

export const countedPlanDefinition = {
  label: COUNTED_PLAN_TYPE,
  templateSchema: countedPlanTemplateSchema,
  configSchema: countedPlanTemplateConfigSchema,
  planSchema: countedPlanSchema,
  instantiatePlan: instantiateCountedPlan,
} satisfies AnyPlanTypeDefinition;

// Register this plan type in the compile-time PlanTypeMap (additive; see planTypeMap.ts).
declare module './planTypeMap' {
  interface PlanTypeMap {
    Counted: typeof countedPlanDefinition;
  }
}
