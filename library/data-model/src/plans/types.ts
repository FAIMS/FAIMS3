import z from 'zod';

// Base schema for plan and plan template. These use passthrough to allow
// for extra fields and will be used to parse JSON payloads with plans
// or plan templates

// A plan template is an optional part of a Notebook Template and will
// be used to instantiate a plan when a notebook is created from the template.
export const PlanTemplateSchema = z
  .object({
    planType: z.string(),
    /**
     * Identifies this plan template among the template's plan templates, and
     * keys the config supplied for it at notebook creation. Optional; where
     * absent `getPlanTemplates` derives one.
     */
    planId: z.string().optional(),
    /** Names the plan on the notebook's plan chooser. */
    label: z.string().optional(),
  })
  .passthrough();
export type PlanTemplate = z.infer<typeof PlanTemplateSchema>;

// A plan is an optional part of a Notebook Definition and can be used
// to guide the data collection workflow.  The plan is instantiated
// from the plan template when a notebook is created from a template.
export const PlanSchema = z
  .object({
    planType: z.string(),
    /**
     * Identifies this plan among the notebook's plans. Optional in stored
     * notebooks so hand-written and legacy single-plan notebooks stay terse;
     * `getNotebookPlans` assigns one where absent.
     */
    planId: z.string().optional(),
    /**
     * Names the plan on the notebook's plan chooser. Carried over from the plan
     * template at instantiation; falls back to the plan type's own label.
     */
    label: z.string().optional(),
  })
  .passthrough();
export type Plan = z.infer<typeof PlanSchema>;

// A plan template schema with a literal planType property.
// This will be used mainly in the registry since we use planType as
// the registry key and we want to ensure that the planType property
// of the plan template matches the registry key.
export type PlanTemplateSchemaWithLiteral<P extends string = string> =
  z.ZodObject<
    {planType: z.ZodLiteral<P>} & z.ZodRawShape,
    z.core.$ZodObjectConfig
  >;

export type PlanTypeFromTemplateSchema<
  TTemplateSchema extends PlanTemplateSchemaWithLiteral,
> =
  TTemplateSchema['shape']['planType'] extends z.ZodLiteral<
    infer P extends string
  >
    ? P
    : string;

// A plan type definition is used to register a
// plan type with the plan registry.
// planType of the plan template and plan schemas must be the same
// and we'll ensure that the plan is stored under this key in the registry
export type PlanTypeDefinition<
  P extends string,
  TTemplateSchema extends PlanTemplateSchemaWithLiteral<P>,
  TConfigSchema extends z.ZodTypeAny,
  TPlanSchema extends z.ZodType<{planType: P} & Record<string, unknown>>,
> = {
  label: string; // display name for this plan type
  templateSchema: TTemplateSchema;
  configSchema: TConfigSchema;
  planSchema: TPlanSchema;
  instantiatePlan: ({
    template,
    config,
  }: {
    template: z.infer<TTemplateSchema>;
    config: z.infer<TConfigSchema>;
  }) => z.infer<TPlanSchema>;
};

export type AnyPlanTypeDefinition = PlanTypeDefinition<any, any, any, any>;

export type PlanRegistry = Map<string, AnyPlanTypeDefinition>;

export type ValidationResult<T> =
  | {success: true; data: T}
  | {success: false; error: z.ZodError | Error};
