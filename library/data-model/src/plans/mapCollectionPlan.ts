/**
 * @file The Map Collection plan type: collect records against a spatially
 * referenced list. Each planned entry carries geometry for one spatial field
 * of the form, plus values for a chosen set of the form's other fields.
 */
import z from 'zod';
import {isSpatialFieldComponent} from '../spatialFields';
import {isListPlanSupportedFieldType} from './listOfRecordsPlan';
import {
  clonePlanFeatureCollection,
  PlanFeatureCollectionSchema,
  type PlanFeature,
  type PlanFeatureCollection,
} from './planGeoJson';
import {
  PlanSchema,
  PlanTemplateSchema,
  type AnyPlanTypeDefinition,
} from './types';

export const MAP_COLLECTION_PLAN_TYPE = 'MapCollection' as const;

/**
 * Field return types a map collection entry can pre-fill with a simple value:
 * the same set a list of records plan supports.
 */
export const isMapCollectionSupportedFieldType = isListPlanSupportedFieldType;

/** Whether a field component can be a map collection plan's spatial field. */
export const isMapCollectionSpatialComponent = isSpatialFieldComponent;

/** One of the form's fields each planned entry may pre-fill. */
export const mapCollectionRecordFieldSchema = z.object({
  fieldId: z.string().min(1),
  /** A required field must be supplied by every entry at configuration. */
  required: z.boolean(),
});
export type MapCollectionRecordField = z.infer<
  typeof mapCollectionRecordFieldSchema
>;

const recordFieldsSchema = z
  .array(mapCollectionRecordFieldSchema)
  .refine(
    fields => new Set(fields.map(f => f.fieldId)).size === fields.length,
    'Each field may be listed once'
  );

// Kept free of object-level refinements so `authoredSchema` can `omit` from it;
// cross-field rules live in `mapCollectionTemplateIssues`.
export const mapCollectionPlanTemplateSchema = PlanTemplateSchema.extend({
  planType: z.literal(MAP_COLLECTION_PLAN_TYPE),
  formType: z.string(),
  /** The form's scalar fields entries pre-fill, each required or optional. */
  recordFields: recordFieldsSchema,
  /** The one spatial field of the form each entry's geometry is written to. */
  spatialFieldId: z.string().min(1),
});
export type MapCollectionPlanTemplate = z.infer<
  typeof mapCollectionPlanTemplateSchema
>;

/**
 * Rules the template schema cannot carry as object refinements. Empty when the
 * template is sound; otherwise one message per problem.
 */
export const mapCollectionTemplateIssues = (template: {
  recordFields: {fieldId: string}[];
  spatialFieldId: string;
}): string[] => {
  const issues: string[] = [];
  if (template.recordFields.some(f => f.fieldId === template.spatialFieldId)) {
    issues.push('The spatial field may not also be a pre-filled field');
  }
  return issues;
};

/** One planned entry: scalar pre-fill values plus its geometry. */
export const mapCollectionPlanEntrySchema = z.object({
  fields: z.record(z.string(), z.unknown()),
  spatial: PlanFeatureCollectionSchema,
});
export type MapCollectionPlanEntry = z.infer<
  typeof mapCollectionPlanEntrySchema
>;

/**
 * A short description of an entry's geometry, e.g. "Point" or "Point × 3":
 * what the designer's preview table and the app's planned entries both label
 * geometry with.
 */
export const mapCollectionGeometrySummary = (
  entry: Pick<MapCollectionPlanEntry, 'spatial'>
): string => {
  const counts = new Map<string, number>();
  for (const feature of entry.spatial.features) {
    counts.set(
      feature.geometry.type,
      (counts.get(feature.geometry.type) ?? 0) + 1
    );
  }
  return [...counts.entries()]
    .map(([type, count]) => (count > 1 ? `${type} × ${count}` : type))
    .join(', ');
};

export const mapCollectionPlanTemplateConfigSchema = z.object({
  /** The planned entries, keyed by a unique plan reference id. */
  recordData: z.record(z.string(), mapCollectionPlanEntrySchema),
  allowExtraRecords: z.boolean(),
});
export type MapCollectionPlanTemplateConfig = z.infer<
  typeof mapCollectionPlanTemplateConfigSchema
>;

export const mapCollectionPlanSchema = PlanSchema.extend({
  planType: z.literal(MAP_COLLECTION_PLAN_TYPE),
  formType: z.string(),
  spatialFieldId: z.string().min(1),
  recordFields: recordFieldsSchema,
  /** A map from a unique plan reference id to that entry's initial data. */
  records: z.record(z.string(), mapCollectionPlanEntrySchema),
  allowExtraRecords: z.boolean(),
});
export type MapCollectionPlan = z.infer<typeof mapCollectionPlanSchema>;

/**
 * The problems with one config entry against a template: required fields it
 * lacks, and geometry it lacks. Empty when the entry is sound. Shared by
 * instantiation and the import pipeline so both report the same rules.
 */
export const mapCollectionEntryIssues = ({
  template,
  entry,
}: {
  template: Pick<MapCollectionPlanTemplate, 'recordFields'>;
  entry: {fields: Record<string, unknown>; spatial?: {features: unknown[]}};
}): string[] => {
  const issues: string[] = [];
  for (const field of template.recordFields) {
    if (!field.required) continue;
    const value = entry.fields[field.fieldId];
    if (value === undefined || value === null || value === '') {
      issues.push(`Missing required field ${field.fieldId}`);
    }
  }
  if (!entry.spatial || entry.spatial.features.length < 1) {
    issues.push('No geometry');
  }
  return issues;
};

/**
 * Create a map collection plan from its template and config. Each entry keeps
 * only the template's record fields, and must carry every required one plus
 * at least one feature.
 */
export const instantiateMapCollectionPlan = ({
  template,
  config,
}: {
  template: MapCollectionPlanTemplate;
  config: MapCollectionPlanTemplateConfig;
}): Omit<MapCollectionPlan, 'planId' | 'label' | 'description'> => {
  if (
    !mapCollectionPlanTemplateSchema.safeParse(template).success ||
    mapCollectionTemplateIssues(template).length > 0
  ) {
    throw new Error('Invalid map collection plan template');
  }

  const records: Record<string, MapCollectionPlanEntry> = {};
  for (const [reference, entry] of Object.entries(config.recordData)) {
    // Built into a new object: writing back into config would strip the
    // unselected fields from the caller's own data.
    const fields: Record<string, unknown> = {};
    for (const {fieldId} of template.recordFields) {
      if (fieldId in entry.fields) {
        fields[fieldId] = entry.fields[fieldId];
      }
    }
    const spatialResult = PlanFeatureCollectionSchema.safeParse(entry.spatial);
    if (!spatialResult.success) {
      throw new Error(
        `Invalid map collection plan entry ${reference}: geometry is not a collection of Point, LineString or Polygon features`
      );
    }
    const issues = mapCollectionEntryIssues({
      template,
      entry: {fields, spatial: spatialResult.data},
    });
    if (issues.length > 0) {
      throw new Error(
        `Invalid map collection plan entry ${reference}: ${issues.join('; ')}`
      );
    }
    records[reference] = {
      fields,
      spatial: clonePlanFeatureCollection(spatialResult.data),
    };
  }

  return {
    planType: MAP_COLLECTION_PLAN_TYPE,
    formType: template.formType,
    spatialFieldId: template.spatialFieldId,
    recordFields: template.recordFields.map(f => ({...f})),
    records,
    allowExtraRecords: config.allowExtraRecords,
  };
};

/**
 * The value to write to the plan's spatial field when a planned entry's record
 * is created, in the shape that field component stores: the MapFormField a
 * FeatureCollection, the TakePoint a single Point feature carrying the GPS
 * properties its schema demands (accuracy 0, since the point was planned
 * rather than measured).
 */
export const mapCollectionSpatialValue = ({
  componentName,
  spatial,
}: {
  componentName: string | undefined;
  spatial: PlanFeatureCollection;
}): PlanFeatureCollection | PlanFeature => {
  if (componentName === 'TakePoint') {
    const point = spatial.features[0];
    return {
      type: 'Feature',
      geometry: point.geometry,
      properties: {
        timestamp: Date.now(),
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 0,
        altitude_accuracy: null,
      },
    };
  }
  return clonePlanFeatureCollection(spatial);
};

/** The initial record data for a planned entry: its fields plus its geometry. */
export const mapCollectionInitialRecordData = ({
  plan,
  entry,
  spatialComponentName,
}: {
  plan: Pick<MapCollectionPlan, 'spatialFieldId'>;
  entry: MapCollectionPlanEntry;
  spatialComponentName: string | undefined;
}): Record<string, unknown> => ({
  ...entry.fields,
  [plan.spatialFieldId]: mapCollectionSpatialValue({
    componentName: spatialComponentName,
    spatial: entry.spatial,
  }),
});

export const mapCollectionPlanDefinition = {
  label: MAP_COLLECTION_PLAN_TYPE,
  templateSchema: mapCollectionPlanTemplateSchema,
  configSchema: mapCollectionPlanTemplateConfigSchema,
  planSchema: mapCollectionPlanSchema,
  instantiatePlan: instantiateMapCollectionPlan,
} satisfies AnyPlanTypeDefinition;

// Register this plan type in the compile-time PlanTypeMap (additive; see planTypeMap.ts).
declare module './planTypeMap' {
  interface PlanTypeMap {
    MapCollection: typeof mapCollectionPlanDefinition;
  }
}
