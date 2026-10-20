// SPDX-License-Identifier: Apache-2.0
/**
 * Shared extraction of a notebook's record geometry: each record's GIS field
 * values (Map / TakePoint components) read via the data engine and returned as
 * GeoJSON features tagged with the owning record.
 *
 * This is the geometry source for the notebook's {@link OverviewMap} tab. It
 * lives in its own module to keep the extraction pipeline and its unit tests
 * separate from the map rendering.
 */
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  MinimalRecordMetadata,
  NotebookUiSpec,
  ProjectID,
  SPATIAL_FIELDS,
  type CompiledNotebookUiSpec,
} from '@faims3/data-model';
import {
  GeoJSONFeatureOrCollectionSchema,
  type GeoJSONFeature,
} from '@faims3/forms';
import {useQueries, type UseQueryResult} from '@tanstack/react-query';
import {useMemo, useRef} from 'react';
import {localGetDataDb} from '../../../utils/database';

/** Properties tagged onto every extracted feature, tracing it to its record. */
export type RecordFeatureProps = {
  name: string;
  record_id: string;
  revision_id: string;
  form_id: string;
};

/** A parsed GeoJSON feature retagged with its owning record's properties. */
export type RecordGeoJSONFeature = Omit<GeoJSONFeature, 'properties'> & {
  properties: RecordFeatureProps;
};

/** The extracted features of all records, as one GeoJSON FeatureCollection. */
export type RecordFeatureCollection = {
  type: 'FeatureCollection';
  features: RecordGeoJSONFeature[];
};

/** Split a notebook FeatureCollection into one collection per form type. */
export function groupRecordFeaturesByForm(
  collection: RecordFeatureCollection
): Map<string, RecordFeatureCollection> {
  const grouped = new Map<string, RecordGeoJSONFeature[]>();
  for (const feature of collection.features) {
    const formId = feature.properties.form_id;
    if (!formId) {
      continue;
    }
    const list = grouped.get(formId);
    if (list) {
      list.push(feature);
    } else {
      grouped.set(formId, [feature]);
    }
  }
  return new Map(
    [...grouped.entries()].map(([formId, features]) => [
      formId,
      {type: 'FeatureCollection', features},
    ])
  );
}

/**
 * Get the names of all GIS fields in a UI Specification: the fields whose AVP
 * values hold record geometry.
 *
 * This is deliberately notebook-wide rather than per-form. A record's AVPs can
 * hold any field it was ever saved with, and a field can be moved between forms
 * (or dropped from every view) long after capture without touching the AVPs
 * that already reference it. Scoping the read to the fields currently reachable
 * from a record's own form would silently stop plotting those records.
 */
export const getGISFields = (uiSpec: NotebookUiSpec): string[] => {
  const fields = Object.getOwnPropertyNames(uiSpec.fields);
  return fields.filter((field: string) =>
    SPATIAL_FIELDS.includes(uiSpec.fields[field]['component-name'])
  );
};

/**
 * Extract features from a single record for the given GIS fields. A malformed
 * GIS value skips its field, so one bad value cannot blank a record's geometry.
 */
export const extractFeaturesFromRecord = async (
  dataEngine: DataEngine,
  record: MinimalRecordMetadata,
  fields: string[]
): Promise<RecordGeoJSONFeature[]> => {
  const values = await dataEngine.hydrated.getFieldValues({
    revisionId: record.revisionId,
    fields,
  });

  const baseProperties: RecordFeatureProps = {
    // TODO bring back HRID - or maybe only on records we click on?
    name: record.recordId,
    record_id: record.recordId,
    revision_id: record.revisionId,
    form_id: record.type,
  };

  return Object.values(values).flatMap(raw => {
    const {data: geoJson, success} =
      GeoJSONFeatureOrCollectionSchema.safeParse(raw);
    // A malformed GIS value skips its field, not the whole record
    if (!success) return [];
    const parsed =
      geoJson.type === 'FeatureCollection' ? geoJson.features : [geoJson];
    return parsed.map(feature => ({...feature, properties: baseProperties}));
  });
};

/** The parameters of {@link useRecordFeatures}. */
interface UseRecordFeaturesParams {
  projectId: ProjectID;
  uiSpec: CompiledNotebookUiSpec;
  /** The records to extract geometry from (typically the full record list). */
  records: MinimalRecordMetadata[] | undefined;
  /**
   * The form types whose records to hydrate (the overview map passes its
   * configured display types). Pass a memoized array; the record filter is
   * memoized on it.
   */
  recordTypes: string[];
}

/**
 * True when two collections plot the same geometries for the same records.
 * Used to keep the overview map's collection identity stable across a
 * parent re-render that rebuilt the array without changing what is on it.
 */
export function recordFeatureSyncKey(
  collection: RecordFeatureCollection | undefined
): string {
  if (!collection) {
    return '';
  }
  // Prefix so an empty plotted collection is not the same key as "no data".
  return `c:${collection.features
    .map(
      feature =>
        `${feature.properties.record_id}:${feature.properties.revision_id}:${feature.properties.form_id}:${JSON.stringify(feature.geometry)}`
    )
    .join('|')}`;
}

/** True when both collections encode the same records, revisions, and geometry. */
export function recordFeatureCollectionsEqual(
  left: RecordFeatureCollection | undefined,
  right: RecordFeatureCollection | undefined
): boolean {
  return recordFeatureSyncKey(left) === recordFeatureSyncKey(right);
}

/**
 * Fold the per-record query results into one collection plus aggregate status.
 * A newly synced record is its own query: while it hydrates, already-ready
 * results stay in the collection so the overview map is not torn down.
 */
const combineRecordQueries = (
  results: UseQueryResult<RecordGeoJSONFeature[], Error>[]
) => {
  const hasAnyData = results.some(result => result.data !== undefined);
  const isError = results.some(result => result.isError);
  const error = results.find(result => result.error)?.error ?? null;
  const isInitialLoading =
    results.length > 0 &&
    !hasAnyData &&
    results.some(result => result.isLoading);

  if (results.length === 0 || isInitialLoading) {
    return {
      data: undefined,
      isLoading: isInitialLoading,
      isError: false,
      error: null,
    };
  }

  if (!hasAnyData) {
    return {
      data: undefined,
      isLoading: false,
      isError,
      error,
    };
  }

  return {
    data: {
      type: 'FeatureCollection' as const,
      features: results.flatMap(result => result.data ?? []),
    } satisfies RecordFeatureCollection,
    isLoading: false,
    isError: false,
    error: null,
  };
};

/**
 * Extract the GIS features of a notebook's records, managed by React Query
 * (record hydration is async database work). Only records whose type is in
 * `recordTypes` are read, each through the notebook's GIS fields, as one query
 * per record so a record syncing in re-reads only itself. Returns the combined
 * state (`data` is undefined while loading or disabled) alongside the memoized
 * `dataEngine` and `gisFields`, so consumers share them without rebuilding
 * their own.
 */
export const useRecordFeatures = ({
  projectId,
  uiSpec,
  records,
  recordTypes,
}: UseRecordFeaturesParams) => {
  // Memoize the data engine to prevent recreation on every render
  const dataEngine = useMemo(() => {
    const dataDb = localGetDataDb(projectId);
    return new DataEngine({
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpec,
    });
  }, [projectId, uiSpec]);

  // The notebook's GIS fields: this both gates and keys the query, and is the
  // field list every record is read through
  const gisFields = useMemo(() => getGISFields(uiSpec), [uiSpec]);

  // Identity is a string so a list that grew in place still creates a query
  // for the new record; array reference alone would keep mapRecords stale.
  const recordsIdentity =
    records
      ?.map(
        record => `${record.recordId}:${record.revisionId}:${record.conflicts}`
      )
      .join(',') ?? '';

  const mapRecords = useMemo(
    () => records?.filter(record => recordTypes.includes(record.type)) ?? [],
    [records, recordsIdentity, recordTypes]
  );

  const gisFieldsKey = gisFields.join(',');

  // Combine in the hook rather than in useQueries: the library's combined
  // result is structurally shared, which can skip a notify when a newly
  // synced record's query lands, leaving the map on the previous features.
  const queryResults = useQueries({
    queries: mapRecords.map(record => ({
      queryKey: [
        'record-features',
        projectId,
        record.recordId,
        record.revisionId,
        // conflicts is part of the key: a conflicting head syncing in can
        // flip it without changing the winning revision id
        record.conflicts,
        gisFieldsKey,
      ],
      queryFn: () => extractFeaturesFromRecord(dataEngine, record, gisFields),
      enabled: gisFields.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      retry: 2,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 10000),
    })),
  });

  const combined = combineRecordQueries(queryResults);
  const stableDataRef = useRef(combined.data);
  if (!recordFeatureCollectionsEqual(stableDataRef.current, combined.data)) {
    stableDataRef.current = combined.data;
  }

  return {
    data: stableDataRef.current,
    isLoading: combined.isLoading,
    isError: combined.isError,
    error: combined.error,
    dataEngine,
    gisFields,
  };
};
