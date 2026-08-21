import z from 'zod';
import {
  AnyPlanTypeDefinition,
  Plan,
  PlanRegistry,
  PlanSchema,
  PlanTemplateSchema,
  PlanTemplateSchemaWithLiteral,
  PlanTypeDefinition,
  ValidationResult,
} from './types';
import {builtInPlanTypes} from './builtins';

// Plan registry is a map from planType to plan type definition.
export const createPlanRegistry = (): PlanRegistry => new Map();

// Default registry will be used at runtime but we allow for other
// registries for testing
const defaultPlanRegistry = createPlanRegistry();
// Built in plan types are not registered at compile time, only when
// we first need to validate a plan, this allows for easier testing
let builtInsInstalled = false;

// Get the plan type from a plan template schema leveraging the zod schema
export const getPlanTypeFromTemplateSchema = <
  P extends string,
  TTemplateSchema extends PlanTemplateSchemaWithLiteral<P>,
>(
  templateSchema: TTemplateSchema
): P => {
  return templateSchema.shape.planType.value as P;
};

// use the plan registry to retrieve the plan definition for a given plan type
export const getPlanTypeDefinition = (
  planType: string,
  registry: PlanRegistry = defaultPlanRegistry
): AnyPlanTypeDefinition | undefined => {
  // install built in plan types if we are using the default registry
  if (registry === defaultPlanRegistry) {
    installBuiltInPlanTypes();
  }

  return registry.get(planType);
};

// Register a plan type definition with a plan registry, by default with
// the defaultPlanRegistry. The planType from the plan template schema is used
// as the key in the registry.
export const registerPlanType = <
  P extends string,
  TTemplateSchema extends PlanTemplateSchemaWithLiteral<P>,
  TConfigSchema extends z.ZodTypeAny,
  TPlanSchema extends z.ZodType<{planType: P} & Record<string, unknown>>,
>(
  definition: PlanTypeDefinition<
    P,
    TTemplateSchema,
    TConfigSchema,
    TPlanSchema
  >,
  registry: PlanRegistry = defaultPlanRegistry
) => {
  const planType = getPlanTypeFromTemplateSchema(definition.templateSchema);

  if (registry.has(planType)) {
    throw new Error(`Plan type ${planType} is already registered`);
  }

  registry.set(planType, definition as unknown as AnyPlanTypeDefinition);
};

export const registerPlanTypes = (
  definitions: readonly AnyPlanTypeDefinition[],
  registry: PlanRegistry = defaultPlanRegistry
) => {
  for (const definition of definitions) {
    registerPlanType(definition, registry);
  }
};

// Here we install the built in plan types into the default registry.
// Doing this lazily allows for easier testing of plan types in isolation.
export const installBuiltInPlanTypes = (
  registry: PlanRegistry = defaultPlanRegistry
) => {
  if (registry === defaultPlanRegistry && builtInsInstalled) {
    return;
  }

  registerPlanTypes(builtInPlanTypes, registry);

  if (registry === defaultPlanRegistry) {
    builtInsInstalled = true;
  }
};

// Validate an object (probably from JSON) as a plan based on the claimed planType using the
// plan registry. If the plan type is unknown, returns an error.
export const safeValidatePlan = (
  input: unknown,
  registry: PlanRegistry = defaultPlanRegistry
): ValidationResult<Plan> => {
  if (registry === defaultPlanRegistry) {
    installBuiltInPlanTypes();
  }

  const baseResult = PlanSchema.safeParse(input);
  if (!baseResult.success) {
    return baseResult;
  }

  const definition = registry.get(baseResult.data.planType);
  if (!definition) {
    return {
      success: false,
      error: new Error(`Unknown plan type: ${baseResult.data.planType}`),
    };
  }

  return definition.planSchema.safeParse(input);
};

// Validate an object (probably from JSON) as a plan template based on
// the claimed planType using the plan registry. If the plan type is unknown, returns an error.
export const safeValidatePlanTemplate = (
  input: unknown,
  registry: PlanRegistry = defaultPlanRegistry
): ValidationResult<Plan> => {
  if (registry === defaultPlanRegistry) {
    installBuiltInPlanTypes();
  }

  const baseResult = PlanTemplateSchema.safeParse(input);
  if (!baseResult.success) {
    return baseResult;
  }

  const definition = registry.get(baseResult.data.planType);
  if (!definition) {
    return {
      success: false,
      error: new Error(`Unknown plan type: ${baseResult.data.planType}`),
    };
  }

  return definition.templateSchema.safeParse(input);
};
