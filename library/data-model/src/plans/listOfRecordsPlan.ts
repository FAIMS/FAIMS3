import z from 'zod';
import {
  PlanSchema,
  PlanTemplateSchema,
  type AnyPlanTypeDefinition,
} from './types';

export const LIST_OF_RECORDS_PLAN_TYPE = 'ListOfRecords' as const;

// A list of records plan defines a set of records that should be
// collected with a few properties of each record included in the plan.
export const listPlanTemplateConfigSchema = z.object({
  recordData: z.record(z.string(), z.record(z.string(), z.unknown())), // the data for each record, keyed by a unique plan reference id
  allowExtraRecords: z.boolean(),
});
export type ListPlanTemplateConfig = z.infer<
  typeof listPlanTemplateConfigSchema
>;

export const listPlanTemplateSchema = PlanTemplateSchema.extend({
  planType: z.literal(LIST_OF_RECORDS_PLAN_TYPE),
  formType: z.string(),
  recordFields: z.array(z.string()), // a subset of the fields in the form
});
export type ListPlanTemplate = z.infer<typeof listPlanTemplateSchema>;

export const listPlanSchema = PlanSchema.extend({
  planType: z.literal(LIST_OF_RECORDS_PLAN_TYPE),
  formType: z.string(),
  // records is a map from a unique plan reference id to the initial data for that record
  records: z.record(z.string(), z.record(z.string(), z.unknown())),
  allowExtraRecords: z.boolean(),
});
export type ListPlan = z.infer<typeof listPlanSchema>;

/**
 * Create a list plan from a list plan template.
 *
 * @param template A list Plan template
 */
export const instantiateListPlan = ({
  template,
  config,
}: {
  template: ListPlanTemplate;
  config: ListPlanTemplateConfig;
}): Omit<ListPlan, 'planId' | 'label'> => {
  // do a local check of the template validity before we try to validate the plan
  if (!listPlanTemplateSchema.safeParse(template).success) {
    throw new Error('Invalid list of records plan template');
  }
  // Filter the records to only include the fields specified in the plan.
  // Built into a new map: writing back into config.recordData would strip the
  // unselected fields from the caller's own object.
  const records: Record<string, Record<string, unknown>> = {};
  for (const [recordId, record] of Object.entries(config.recordData)) {
    const filteredRecord: Record<string, unknown> = {};
    for (const field of template.recordFields) {
      if (field in record) {
        filteredRecord[field] = record[field];
      }
    }
    records[recordId] = filteredRecord;
  }

  return {
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    formType: template.formType,
    records: records,
    allowExtraRecords: config.allowExtraRecords,
  };
};

export const listOfRecordsPlanDefinition = {
  label: LIST_OF_RECORDS_PLAN_TYPE,
  templateSchema: listPlanTemplateSchema,
  configSchema: listPlanTemplateConfigSchema,
  planSchema: listPlanSchema,
  instantiatePlan: instantiateListPlan,
} satisfies AnyPlanTypeDefinition;

// Register this plan type in the compile-time PlanTypeMap (additive; see planTypeMap.ts).
declare module './planTypeMap' {
  interface PlanTypeMap {
    ListOfRecords: typeof listOfRecordsPlanDefinition;
  }
}
