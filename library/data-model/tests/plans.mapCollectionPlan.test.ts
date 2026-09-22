import {
  MAP_COLLECTION_PLAN_TYPE,
  instantiateMapCollectionPlan,
  mapCollectionGeometrySummary,
  mapCollectionInitialRecordData,
  mapCollectionPlanDefinition,
  mapCollectionPlanTemplateConfigSchema,
  mapCollectionPlanTemplateSchema,
  mapCollectionSpatialValue,
  mapCollectionTemplateIssues,
  type MapCollectionPlanTemplate,
} from '../src/plans/mapCollectionPlan';
import type {PlanFeatureCollection} from '../src/plans/planGeoJson';
import {authoredSchema} from '../src/plans/types';
import {safeValidatePlan} from '../src/plans/registry';

const point = (lon: number, lat: number): PlanFeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [lon, lat]},
      properties: null,
    },
  ],
});

const template: MapCollectionPlanTemplate = {
  planId: 'sites',
  planType: MAP_COLLECTION_PLAN_TYPE,
  label: 'Sites',
  formType: 'site-form',
  recordFields: [
    {fieldId: 'Name', required: true},
    {fieldId: 'Notes', required: false},
  ],
  spatialFieldId: 'Location',
};

describe('map collection plan definition', () => {
  test('uses the map-collection discriminator in its template schema and definition', () => {
    expect(mapCollectionPlanTemplateSchema.shape.planType.value).toBe(
      MAP_COLLECTION_PLAN_TYPE
    );
    expect(mapCollectionPlanDefinition.label).toBe(MAP_COLLECTION_PLAN_TYPE);
  });

  test('template schema rejects a repeated record field and an empty spatial field', () => {
    expect(
      mapCollectionPlanTemplateSchema.safeParse({
        ...template,
        recordFields: [
          {fieldId: 'Name', required: true},
          {fieldId: 'Name', required: false},
        ],
      }).success
    ).toBe(false);
    expect(
      mapCollectionPlanTemplateSchema.safeParse({
        ...template,
        spatialFieldId: '',
      }).success
    ).toBe(false);
  });

  test('the authored schema can be derived, and cross-field issues are reported separately', () => {
    const authored = authoredSchema(mapCollectionPlanTemplateSchema);
    const {planId: _planId, ...rest} = template;
    expect(authored.safeParse(rest).success).toBe(true);
    expect(mapCollectionTemplateIssues(template)).toEqual([]);
    expect(
      mapCollectionTemplateIssues({
        recordFields: [{fieldId: 'Location'}],
        spatialFieldId: 'Location',
      })
    ).toHaveLength(1);
  });

  test('config schema requires at least one feature per entry', () => {
    expect(
      mapCollectionPlanTemplateConfigSchema.safeParse({
        recordData: {
          'planned-1': {fields: {Name: 'A'}, spatial: point(151, -33)},
        },
        allowExtraRecords: false,
      }).success
    ).toBe(true);
    expect(
      mapCollectionPlanTemplateConfigSchema.safeParse({
        recordData: {
          'planned-1': {
            fields: {Name: 'A'},
            spatial: {type: 'FeatureCollection', features: []},
          },
        },
        allowExtraRecords: false,
      }).success
    ).toBe(false);
  });

  test('instantiate keeps only the template fields and copies the geometry', () => {
    const spatial = point(151, -33);
    const plan = instantiateMapCollectionPlan({
      template,
      config: {
        recordData: {
          'planned-1': {fields: {Name: 'A', Notes: 'n', Other: 'x'}, spatial},
        },
        allowExtraRecords: true,
      },
    });
    expect(plan).toEqual({
      planType: MAP_COLLECTION_PLAN_TYPE,
      formType: 'site-form',
      spatialFieldId: 'Location',
      recordFields: template.recordFields,
      records: {'planned-1': {fields: {Name: 'A', Notes: 'n'}, spatial}},
      allowExtraRecords: true,
    });
    // A copy, so the plan cannot be edited through the caller's config
    expect(plan.records['planned-1'].spatial).not.toBe(spatial);
    expect(plan.recordFields).not.toBe(template.recordFields);

    // And the result validates through the registry with the base fields added
    const validated = safeValidatePlan({
      ...plan,
      planId: template.planId,
      label: template.label,
    });
    expect(validated.success).toBe(true);
  });

  test('instantiate rejects an entry missing a required field', () => {
    expect(() =>
      instantiateMapCollectionPlan({
        template,
        config: {
          recordData: {
            'planned-1': {fields: {Notes: 'n'}, spatial: point(1, 2)},
          },
          allowExtraRecords: false,
        },
      })
    ).toThrow(/Missing required field Name/);
  });

  test('instantiate rejects an entry whose geometry is not simple', () => {
    expect(() =>
      instantiateMapCollectionPlan({
        template,
        config: {
          recordData: {
            'planned-1': {
              fields: {Name: 'A'},
              spatial: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {type: 'MultiPoint', coordinates: [[1, 2]]},
                    properties: null,
                  },
                ],
              } as unknown as PlanFeatureCollection,
            },
          },
          allowExtraRecords: false,
        },
      })
    ).toThrow(/geometry/);
  });

  test('instantiate rejects a template whose spatial field is also pre-filled', () => {
    expect(() =>
      instantiateMapCollectionPlan({
        template: {
          ...template,
          recordFields: [{fieldId: 'Location', required: false}],
        },
        config: {recordData: {}, allowExtraRecords: false},
      })
    ).toThrow(/Invalid map collection plan template/);
  });

  test('spatial value takes the shape of the field component', () => {
    const spatial = point(151, -33);
    expect(
      mapCollectionSpatialValue({componentName: 'MapFormField', spatial})
    ).toEqual(spatial);
    const forTakePoint = mapCollectionSpatialValue({
      componentName: 'TakePoint',
      spatial,
    });
    expect(forTakePoint).toMatchObject({
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151, -33]},
      properties: {accuracy: 0, altitude: null},
    });
    expect(
      typeof (forTakePoint as {properties: {timestamp: number}}).properties
        .timestamp
    ).toBe('number');
  });

  test('geometry summary counts each type, and only counts more than one', () => {
    expect(mapCollectionGeometrySummary({spatial: point(151, -33)})).toBe(
      'Point'
    );
    expect(
      mapCollectionGeometrySummary({
        spatial: {
          type: 'FeatureCollection',
          features: [
            ...point(151, -33).features,
            ...point(152, -34).features,
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [151, -33],
                  [152, -34],
                ],
              },
              properties: null,
            },
          ],
        },
      })
    ).toBe('Point × 2, LineString');
  });

  test('initial record data joins the fields to the spatial field', () => {
    const spatial = point(151, -33);
    expect(
      mapCollectionInitialRecordData({
        plan: {spatialFieldId: 'Location'},
        entry: {fields: {Name: 'A'}, spatial},
        spatialComponentName: 'MapFormField',
      })
    ).toEqual({Name: 'A', Location: spatial});
  });
});
