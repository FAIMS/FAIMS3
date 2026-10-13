/**
 * @file Turn a Map Collection plan's entries into the GeoJSON the plan record
 * map plots: one feature per planned geometry, tagged with the entry it
 * belongs to and whether that entry's record exists yet. Pure, so the shape
 * the map reads is tested without OpenLayers.
 */
import {
  planReferenceFor,
  type MapCollectionPlan,
  type MinimalRecordMetadata,
  type PlanGeometry,
} from '@faims3/data-model';

/** Properties tagged onto every plotted feature, tracing it to its entry. */
export type PlanRecordFeatureProps = {
  /** The entry's key in `plan.records`. */
  reference: string;
  /** The `planReference` a record of this entry carries. */
  planReference: string;
  /** Whether a record claiming this entry is in the plan's record list. */
  created: boolean;
};

/** One plotted feature of a planned entry's geometry. */
export type PlanRecordFeature = {
  type: 'Feature';
  geometry: PlanGeometry;
  properties: PlanRecordFeatureProps;
};

/** The FeatureCollection the plan record map plots. */
export type PlanRecordFeatureCollection = {
  type: 'FeatureCollection';
  features: PlanRecordFeature[];
};

/**
 * Which plan references a record has been created for, from the plan's own
 * records: a claimed reference is proof the record exists.
 */
export const createdPlanReferences = (
  planRecords: MinimalRecordMetadata[]
): Set<string> => {
  const created = new Set<string>();
  for (const record of planRecords) {
    if (record.planReference) created.add(record.planReference);
  }
  return created;
};

/** The features to plot for a plan, given which entries already have a record. */
export const planRecordFeatures = ({
  plan,
  created,
}: {
  plan: Pick<MapCollectionPlan, 'planId' | 'records'>;
  created: Set<string>;
}): PlanRecordFeatureCollection => ({
  type: 'FeatureCollection',
  features: Object.entries(plan.records).flatMap(([reference, entry]) => {
    const planReference = planReferenceFor({planId: plan.planId, reference});
    return entry.spatial.features.map(feature => ({
      type: 'Feature' as const,
      geometry: feature.geometry,
      properties: {
        reference,
        planReference,
        created: created.has(planReference),
      },
    }));
  }),
});
