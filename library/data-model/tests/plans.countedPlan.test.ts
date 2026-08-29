import {z} from 'zod';
import {
  COUNTED_PLAN_TYPE,
  countedPlanDefinition,
  countedPlanTemplateConfigSchema,
  countedPlanTemplateSchema,
  instantiateCountedPlan,
} from '../src/plans/countedPlan';

describe('counted plan definition', () => {
  test('uses the counted discriminator in its template schema and definition', () => {
    expect(countedPlanTemplateSchema.shape.planType.value).toBe(
      COUNTED_PLAN_TYPE
    );
    expect(countedPlanDefinition.label).toBe(COUNTED_PLAN_TYPE);
  });

  test('config schema accepts valid configuration', () => {
    const result = countedPlanTemplateConfigSchema.safeParse({
      numberRequired: 2,
      allowExtraRecords: false,
    });

    expect(result.success).toBe(true);
  });

  test('config schema rejects invalid configuration', () => {
    const result = countedPlanTemplateConfigSchema.safeParse({
      numberRequired: 0,
      allowExtraRecords: 'yes',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  test('instantiateCountedPlan combines template and config into a counted plan', () => {
    const plan = instantiateCountedPlan({
      template: {
        planId: 'artefacts',
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
      },
      config: {
        numberRequired: 5,
        allowExtraRecords: true,
      },
    });

    // No planId: the caller carries it over from the template
    expect(plan).toEqual({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
      numberRequired: 5,
      allowExtraRecords: true,
    });
  });
});
