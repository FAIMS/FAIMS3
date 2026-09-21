import z from 'zod';
import {
  PlanSchema,
  PlanTemplateSchema,
  type AnyPlanTypeDefinition,
} from './types';

export const LIST_OF_FORMS_PLAN_TYPE = 'ListOfForms' as const;

// A list of forms plan presents a set of the notebook's forms for creating
// and browsing records. The forms are fixed by the template, so there is
// nothing to supply when a notebook is created from it.
export const listOfFormsPlanTemplateConfigSchema = z.object({});
export type ListOfFormsPlanTemplateConfig = z.infer<
  typeof listOfFormsPlanTemplateConfigSchema
>;

// At least one form, each named once: a repeated entry would present the
// same form twice.
const formTypesSchema = z
  .array(z.string().min(1))
  .min(1)
  .refine(
    forms => new Set(forms).size === forms.length,
    'Form types must not repeat'
  );

export const listOfFormsPlanTemplateSchema = PlanTemplateSchema.extend({
  planType: z.literal(LIST_OF_FORMS_PLAN_TYPE),
  formTypes: formTypesSchema,
});

export type ListOfFormsPlanTemplate = z.infer<
  typeof listOfFormsPlanTemplateSchema
>;

export const listOfFormsPlanSchema = PlanSchema.extend({
  planType: z.literal(LIST_OF_FORMS_PLAN_TYPE),
  formTypes: formTypesSchema,
});

export type ListOfFormsPlan = z.infer<typeof listOfFormsPlanSchema>;

/**
 * Create a list of forms plan from its template. The config carries nothing,
 * so the plan is the template's forms carried over.
 *
 * @param template A list of forms plan template
 */
export const instantiateListOfFormsPlan = ({
  template,
}: {
  template: ListOfFormsPlanTemplate;
  config: ListOfFormsPlanTemplateConfig;
}): Omit<ListOfFormsPlan, 'planId' | 'label' | 'description'> => {
  if (!listOfFormsPlanTemplateSchema.safeParse(template).success) {
    throw new Error('Invalid list of forms plan template');
  }
  return {
    planType: LIST_OF_FORMS_PLAN_TYPE,
    formTypes: [...template.formTypes],
  };
};

export const listOfFormsPlanDefinition = {
  label: LIST_OF_FORMS_PLAN_TYPE,
  templateSchema: listOfFormsPlanTemplateSchema,
  configSchema: listOfFormsPlanTemplateConfigSchema,
  planSchema: listOfFormsPlanSchema,
  instantiatePlan: instantiateListOfFormsPlan,
} satisfies AnyPlanTypeDefinition;

// Register this plan type in the compile-time PlanTypeMap (additive; see planTypeMap.ts).
declare module './planTypeMap' {
  interface PlanTypeMap {
    ListOfForms: typeof listOfFormsPlanDefinition;
  }
}
