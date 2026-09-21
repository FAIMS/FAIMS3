import {
  LIST_OF_FORMS_PLAN_TYPE,
  instantiateListOfFormsPlan,
  listOfFormsPlanDefinition,
  listOfFormsPlanTemplateConfigSchema,
  listOfFormsPlanTemplateSchema,
} from '../src/plans/listOfFormsPlan';

describe('list of forms plan definition', () => {
  test('uses the list-of-forms discriminator in its template schema and definition', () => {
    expect(listOfFormsPlanTemplateSchema.shape.planType.value).toBe(
      LIST_OF_FORMS_PLAN_TYPE
    );
    expect(listOfFormsPlanDefinition.label).toBe(LIST_OF_FORMS_PLAN_TYPE);
  });

  test('config schema accepts an empty config', () => {
    expect(listOfFormsPlanTemplateConfigSchema.safeParse({}).success).toBe(
      true
    );
  });

  test('template schema requires at least one form, named once', () => {
    const base = {
      planId: 'calibration',
      planType: LIST_OF_FORMS_PLAN_TYPE,
      label: 'Calibration',
    };
    expect(
      listOfFormsPlanTemplateSchema.safeParse({...base, formTypes: []}).success
    ).toBe(false);
    expect(
      listOfFormsPlanTemplateSchema.safeParse({
        ...base,
        formTypes: ['Calibration', 'Calibration'],
      }).success
    ).toBe(false);
    expect(
      listOfFormsPlanTemplateSchema.safeParse({
        ...base,
        formTypes: ['Calibration', 'Instrument'],
      }).success
    ).toBe(true);
  });

  test('instantiateListOfFormsPlan carries the template forms over', () => {
    const plan = instantiateListOfFormsPlan({
      template: {
        planId: 'calibration',
        planType: LIST_OF_FORMS_PLAN_TYPE,
        label: 'Calibration',
        formTypes: ['Calibration', 'Instrument'],
      },
      config: {},
    });

    // No planId or label: the caller carries both over from the template
    expect(plan).toEqual({
      planType: LIST_OF_FORMS_PLAN_TYPE,
      formTypes: ['Calibration', 'Instrument'],
    });
  });
});
