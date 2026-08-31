import z from 'zod';
import {
  createPlanRegistry,
  getPlanTypeDefinition,
  getPlanTypeFromTemplateSchema,
  installBuiltInPlanTypes,
  registerPlanType,
  registerPlanTypes,
  safeValidatePlan,
} from '../src/plans/registry';
import type {PlanTypeDefinition} from '../src/plans/types';

const TEST_PLAN_TYPE = 'TestPlan' as const;

const testTemplateSchema = z
  .object({
    planType: z.literal(TEST_PLAN_TYPE),
    formType: z.string(),
  })
  .passthrough();

const testConfigSchema = z.object({
  requiredCount: z.number().int().positive(),
});

const testPlanSchema = z
  .object({
    planType: z.literal(TEST_PLAN_TYPE),
    formType: z.string(),
    requiredCount: z.number().int().positive(),
  })
  .passthrough();

const testPlanDefinition: PlanTypeDefinition<
  typeof TEST_PLAN_TYPE,
  typeof testTemplateSchema,
  typeof testConfigSchema,
  typeof testPlanSchema
> = {
  label: 'Test plan',
  templateSchema: testTemplateSchema,
  configSchema: testConfigSchema,
  planSchema: testPlanSchema,
  instantiatePlan: ({template, config}) => ({
    planType: template.planType,
    formType: template.formType,
    requiredCount: config.requiredCount,
  }),
};

describe('plan registry', () => {
  test('createPlanRegistry returns an empty registry', () => {
    const registry = createPlanRegistry();

    expect(registry.size).toBe(0);
  });

  test('getPlanTypeFromTemplateSchema extracts the literal plan type', () => {
    expect(getPlanTypeFromTemplateSchema(testTemplateSchema)).toBe(
      TEST_PLAN_TYPE
    );
  });

  test('registerPlanType stores a definition under its template discriminator', () => {
    const registry = createPlanRegistry();

    registerPlanType(testPlanDefinition, registry);

    expect(getPlanTypeDefinition(TEST_PLAN_TYPE, registry)).toBe(
      testPlanDefinition
    );
  });

  test('registerPlanType rejects duplicate registration in the same registry', () => {
    const registry = createPlanRegistry();

    registerPlanType(testPlanDefinition, registry);

    expect(() => registerPlanType(testPlanDefinition, registry)).toThrow(
      `Plan type ${TEST_PLAN_TYPE} is already registered`
    );
  });

  test('registerPlanTypes registers multiple definitions into a custom registry', () => {
    const registry = createPlanRegistry();
    const otherPlanType = 'OtherPlan' as const;
    const otherTemplateSchema = z
      .object({
        planType: z.literal(otherPlanType),
      })
      .passthrough();
    const otherPlanDefinition: PlanTypeDefinition<
      typeof otherPlanType,
      typeof otherTemplateSchema,
      typeof testConfigSchema,
      typeof testPlanSchema
    > = {
      label: 'Other plan',
      templateSchema: otherTemplateSchema,
      configSchema: testConfigSchema,
      planSchema: z
        .object({
          planType: z.literal(otherPlanType),
          requiredCount: z.number().int().positive(),
        })
        .passthrough(),
      instantiatePlan: ({config}) => ({
        planType: otherPlanType,
        requiredCount: config.requiredCount,
      }),
    };

    registerPlanTypes([testPlanDefinition, otherPlanDefinition], registry);

    expect(registry.size).toBe(2);
    expect(getPlanTypeDefinition(otherPlanType, registry)).toBe(
      otherPlanDefinition
    );
  });

  test('safeValidatePlan rejects payloads without a valid base plan shape', () => {
    const registry = createPlanRegistry();
    const result = safeValidatePlan({}, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  test('safeValidatePlan rejects unknown plan types', () => {
    const registry = createPlanRegistry();
    const result = safeValidatePlan({planType: 'UnknownPlan'}, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Unknown plan type: UnknownPlan');
    }
  });

  test('safeValidatePlan validates a known plan with the registered schema', () => {
    const registry = createPlanRegistry();
    registerPlanType(testPlanDefinition, registry);

    const result = safeValidatePlan(
      {
        planType: TEST_PLAN_TYPE,
        formType: 'record-form',
        requiredCount: 3,
      },
      registry
    );

    expect(result).toEqual({
      success: true,
      data: {
        planType: TEST_PLAN_TYPE,
        formType: 'record-form',
        requiredCount: 3,
      },
    });
  });

  test('installBuiltInPlanTypes is safe to call repeatedly for the default registry', () => {
    expect(() => installBuiltInPlanTypes()).not.toThrow();
    expect(() => installBuiltInPlanTypes()).not.toThrow();

    expect(getPlanTypeDefinition('Counted')).toBeDefined();
    expect(getPlanTypeDefinition('ListOfRecords')).toBeDefined();
  });
});
