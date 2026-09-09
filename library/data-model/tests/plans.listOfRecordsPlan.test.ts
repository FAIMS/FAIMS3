import {
  LIST_OF_RECORDS_PLAN_TYPE,
  instantiateListPlan,
  listOfRecordsPlanDefinition,
  listPlanTemplateConfigSchema,
  listPlanTemplateSchema,
} from '../src/plans/listOfRecordsPlan';

describe('list of records plan definition', () => {
  test('uses the list-of-records discriminator in its template schema and definition', () => {
    expect(listPlanTemplateSchema.shape.planType.value).toBe(
      LIST_OF_RECORDS_PLAN_TYPE
    );
    expect(listOfRecordsPlanDefinition.label).toBe(LIST_OF_RECORDS_PLAN_TYPE);
  });

  test('config schema accepts record data maps', () => {
    const result = listPlanTemplateConfigSchema.safeParse({
      recordData: {Record1: {Name: 'Record 1'}},
      allowExtraRecords: false,
    });

    expect(result.success).toBe(true);
  });

  test('instantiateListPlan keeps only requested record fields', () => {
    const plan = instantiateListPlan({
      template: {
        planId: 'survey',
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        label: 'Survey',
        formType: 'survey-form',
        recordFields: ['Name', 'Location'],
      },
      config: {
        recordData: {
          Record1: {
            Name: 'Record 1',
            Location: 'Trench A',
            Notes: 'Ignored',
          },
          Record2: {
            Name: 'Record 2',
            Other: 'Skipped field',
          },
        },
        allowExtraRecords: true,
      },
    });

    // No planId or label: the caller carries both over from the template
    expect(plan).toEqual({
      planType: LIST_OF_RECORDS_PLAN_TYPE,
      formType: 'survey-form',
      records: {
        Record1: {Name: 'Record 1', Location: 'Trench A'},
        Record2: {Name: 'Record 2'},
      },
      allowExtraRecords: true,
    });
  });
});
