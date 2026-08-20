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
import {useMemo} from 'react';
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
    recordId: record.recordId,
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
 * Fold the per-record query results into one collection plus aggregate status.
 * Module-scope so the reference is stable: React Query memoizes the combined
 * value on it, keeping the collection's identity stable across renders.
 */
const combineRecordQueries = (
  results: UseQueryResult<RecordGeoJSONFeature[], Error>[]
) => ({
  data:
    results.length > 0 && results.every(result => result.data !== undefined)
      ? ({
          type: 'FeatureCollection' as const,
          features: results.flatMap(result => result.data ?? []),
        } satisfies RecordFeatureCollection)
      : undefined,
  isLoading: results.some(result => result.isLoading),
  isError: results.some(result => result.isError),
  error: results.find(result => result.error)?.error ?? null,
});

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

  const mapRecords = useMemo(
    () => records?.filter(record => recordTypes.includes(record.type)) ?? [],
    [records, recordTypes]
  );

  const gisFieldsKey = gisFields.join(',');

  const {data, isLoading, isError, error} = useQueries({
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
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      retry: 2,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 10000),
    })),
    combine: combineRecordQueries,
  });

  return {data, isLoading, isError, error, dataEngine, gisFields};
};
