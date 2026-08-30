import z from 'zod';

// Base schema for plan and plan template. These use passthrough to allow
// for extra fields and will be used to parse JSON payloads with plans
// or plan templates

/**
 * Anything that survives the route segment a plan is addressed by. `%` is out
 * because the router decodes an escape back into whatever it hid.
 */
const routeSafeSchema = (what: string) =>
  z
    .string()
    .min(1)
    .regex(/^[^/\\?#%]+$/, `A ${what} may not contain / \\ ? # or %`)
    // `.` and `..` are route navigation, so a segment of only dots is not one
    .refine(value => !/^\.+$/.test(value), `A ${what} may not be only dots`);

/**
 * A plan id addresses one plan within a notebook, including as a segment of a
 * route, so it may not carry the characters that would split it.
 */
export const PlanIdSchema = routeSafeSchema('plan id');

/** A plan type keys the registry, and `derivePlanId` mints plan ids from it. */
export const PlanTypeSchema = routeSafeSchema('plan type');

// A plan template is an optional part of a Notebook Template and will
// be used to instantiate a plan when a notebook is created from the template.
export const PlanTemplateSchema = z
  .object({
    planType: PlanTypeSchema,
    /**
     * Identifies this plan template among the template's plan templates, and
     * keys the config supplied for it at notebook creation. Minted once when
     * the plan is authored, so reordering the list cannot re-address it.
     */
    planId: PlanIdSchema,
    /**
     * Names the plan wherever the app shows it, the chooser that picks it and
     * the screen it opens alike. Trimmed, so two labels rendered identically
     * are not held apart by their whitespace.
     */
    label: z.string().trim().min(1),
  })
  .passthrough();
export type PlanTemplate = z.infer<typeof PlanTemplateSchema>;

/**
 * A plan type's template schema as a dialog authors it: the id is the designer
 * store's to mint, so a dialog validates against everything but that.
 */
export const authoredSchema = <
  Shape extends z.ZodRawShape & {planId: z.ZodTypeAny},
>(
  schema: z.ZodObject<Shape, z.core.$ZodObjectConfig>
) =>
  // `Shape` carries `planId`, but the mask `omit` asks for is written against a
  // resolved shape, which a generic one is not.
  schema.omit({planId: true} as {planId: true} & Record<
    Exclude<'planId', keyof Shape>,
    never
  >);

export const AuthoredPlanTemplateSchema = authoredSchema(PlanTemplateSchema);

/**
 * A plan template as authored, before the id that addresses it is minted. Plan
 * dialogs produce this; the designer store mints the id and keeps it.
 *
 * `planId?: never` rejects a dialog that writes an id as a literal, but `omit`
 * leaves the passthrough catchall behind, so a parsed value can still carry one
 * past the type. The guarantee is the store: both reducers write `planId` last.
 */
export type AuthoredPlanTemplate = z.infer<
  typeof AuthoredPlanTemplateSchema
> & {planId?: never};

// A plan is an optional part of a Notebook Definition and can be used
// to guide the data collection workflow.  The plan is instantiated
// from the plan template when a notebook is created from a template.
export const PlanSchema = z
  .object({
    planType: PlanTypeSchema,
    /**
     * Identifies this plan among the notebook's plans, and addresses it in
     * routes and record references. Carried over from the plan template.
     */
    planId: PlanIdSchema,
    /**
     * Names the plan wherever the app shows it, the chooser that picks it and
     * the screen it opens, which is all a user has to tell two plans on one
     * form apart, so a plan must carry one. Trimmed, and carried over from the
     * plan template at instantiation.
     */
    label: z.string().trim().min(1),
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
  /**
   * Builds one notebook's plan from its template and config. The id and label
   * are the caller's to add, from the plan template, so a new plan type has two
   * fewer things to remember.
   */
  instantiatePlan: ({
    template,
    config,
  }: {
    template: z.infer<TTemplateSchema>;
    config: z.infer<TConfigSchema>;
  }) => Omit<z.infer<TPlanSchema>, 'planId' | 'label'>;
};

export type AnyPlanTypeDefinition = PlanTypeDefinition<any, any, any, any>;

export type PlanRegistry = Map<string, AnyPlanTypeDefinition>;

export type ValidationResult<T> =
  | {success: true; data: T}
  | {success: false; error: z.ZodError | Error};
