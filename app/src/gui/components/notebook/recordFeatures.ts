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
  DocumentNotFoundError,
  MinimalRecordMetadata,
  NotebookUiSpec,
  ProjectID,
  SPATIAL_FIELDS,
  type CompiledNotebookUiSpec,
} from '@faims3/data-model';
import {GeoJSONFeatureOrCollectionSchema} from '@faims3/forms';
import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {localGetDataDb} from '../../../utils/database';

/** Properties tagged onto every extracted feature, tracing it to its record. */
export type RecordFeatureProps = {
  name: string;
  record_id: string;
  revision_id: string;
  form_id: string;
};

/** A GeoJSON feature extracted from a record's GIS field. */
export type RecordGeoJSONFeature = {
  type: string;
  geometry?: unknown;
  properties?: RecordFeatureProps;
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
 * Extract features from a single record for the given GIS fields.
 *
 * A revision or AVP that is simply missing skips its record or field, and a
 * malformed GIS value skips its field, so one bad record cannot blank every
 * record's geometry. Any other read failure is rethrown, so a systemic fault
 * surfaces as an error rather than as an empty map.
 */
export const extractFeaturesFromRecord = async (
  dataEngine: DataEngine,
  record: MinimalRecordMetadata,
  fields: string[]
): Promise<RecordGeoJSONFeature[]> => {
  const features: RecordGeoJSONFeature[] = [];

  if (fields.length === 0) return features;

  // TODO this is not optimal for efficiency
  const revision = await dataEngine.core
    .getRevision(record.revisionId)
    .catch(error => {
      if (!(error instanceof DocumentNotFoundError)) throw error;
      // This one record's revision is gone; keep plotting the rest
      console.warn(
        `Skipping record ${record.recordId}: revision ${record.revisionId} not found`
      );
      return undefined;
    });

  if (!revision) return features;

  await Promise.all(
    fields.map(async field => {
      try {
        const avpId = revision.avps[field];
        if (!avpId) return;

        const avpData = await dataEngine.core.getAvp(avpId);
        const dataRaw = avpData?.data;
        if (!dataRaw) return;

        const {data: geoJson, success} =
          GeoJSONFeatureOrCollectionSchema.safeParse(dataRaw);

        if (!success) {
          return;
        }

        const baseProperties: RecordFeatureProps = {
          // TODO bring back HRID - or maybe only on records we click on?
          name: record.recordId,
          record_id: record.recordId,
          revision_id: record.revisionId,
          form_id: record.type,
        };

        if (geoJson.type === 'FeatureCollection') {
          // Handle FeatureCollection with multiple features
          geoJson.features?.forEach(feature => {
            if (feature && feature.geometry) {
              features.push({
                ...feature,
                properties: baseProperties,
              });
            }
          });
        } else if (geoJson.type === 'Feature') {
          // Handle single Feature or geometry object
          features.push({
            ...geoJson,
            properties: baseProperties,
          });
        }
      } catch (error) {
        // A missing AVP skips only this field; anything else is systemic
        if (!(error instanceof DocumentNotFoundError)) throw error;
        console.warn(
          `Skipping field ${field} of record ${record.recordId}: AVP not found`
        );
      }
    })
  );

  return features;
};

/** The parameters of {@link useRecordFeatures}. */
interface UseRecordFeaturesParams {
  projectId: ProjectID;
  uiSpec: CompiledNotebookUiSpec;
  /** The records to extract geometry from (typically the full record list). */
  records: MinimalRecordMetadata[] | undefined;
  /**
   * The form types whose records to hydrate (the overview map passes its
   * configured display types). Pass a memoized array; it participates in the
   * query key.
   */
  recordTypes: string[];
}

/**
 * Extract the GIS features of a notebook's records, managed by React Query
 * (record hydration is async database work). Only records whose type is in
 * `recordTypes` are read, each through the notebook's GIS fields. Returns the
 * query state (`data` is undefined while loading or disabled) alongside the
 * memoized `dataEngine` and `gisFields`, so consumers share them without
 * rebuilding their own.
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

  // Memoized: rebuilding this O(records) string on every render would tax
  // large notebooks even while the query is disabled or fresh.
  const recordsSignature = useMemo(
    () =>
      mapRecords
        // conflicts is part of the signature: a conflicting head syncing in
        // can flip it without changing the winning revision id
        .map(r => `${r.recordId}:${r.revisionId}:${r.conflicts}`)
        .join(','),
    [mapRecords]
  );

  /**
   * Query function to fetch all features from all records
   */
  const fetchAllFeatures = async (): Promise<RecordFeatureCollection> => {
    if (gisFields.length === 0 || mapRecords.length === 0) {
      return {type: 'FeatureCollection', features: []};
    }

    // Process records in parallel with concurrency limit to avoid overwhelming the DB
    const BATCH_SIZE = 10;
    const allFeatures: RecordGeoJSONFeature[] = [];

    for (let i = 0; i < mapRecords.length; i += BATCH_SIZE) {
      const batch = mapRecords.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(record =>
          extractFeaturesFromRecord(dataEngine, record, gisFields)
        )
      );
      allFeatures.push(...batchResults.flat());
    }

    return {
      type: 'FeatureCollection',
      features: allFeatures,
    };
  };

  // Use React Query to manage the async feature fetching
  const query = useQuery({
    queryKey: [
      'record-features',
      projectId,
      recordsSignature,
      gisFields.join(','),
      recordTypes.join(','),
    ],
    queryFn: fetchAllFeatures,
    enabled: gisFields.length > 0 && mapRecords.length > 0,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Read only the props consumers use. Spreading `query` would touch every key
  // on React Query's tracked-props proxy (including `promise`, which rejects
  // the observer's internal thenable when prefetch-in-render is off), causing
  // re-renders on unrelated state such as isFetching and dataUpdatedAt.
  const {data, isLoading, isError, error} = query;

  return {data, isLoading, isError, error, dataEngine, gisFields};
};
