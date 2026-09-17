/**
 * @file The spatial import pipeline: source -> format adapter -> explode
 * geometry -> group into entries -> extract fields -> build geometry ->
 * validate against the template -> Map Collection config `recordData`.
 */
import {
  mapCollectionEntryIssues,
  type MapCollectionPlanEntry,
} from '../mapCollectionPlan';
import type {PlanFeatureCollection} from '../planGeoJson';
import {explodeGeometry} from './explodeGeometry';
import {extractFields} from './extractFields';
import {geoJsonAdapter} from './formats/geojson';
import {kmlAdapter} from './formats/kml';
import {groupEntries, type GroupingStrategy} from './groupEntries';
import type {
  EntryDraft,
  SimpleFeature,
  SpatialFormatAdapter,
  SpatialImportContext,
  SpatialImportError,
  SpatialImportFormat,
  SpatialImportResult,
} from './types';

const adapters: Record<SpatialImportFormat, SpatialFormatAdapter> = {
  geojson: geoJsonAdapter,
  kml: kmlAdapter,
};

/** The adapter for a format, for pickers to read labels and accept lists. */
export const getSpatialFormatAdapter = (
  format: SpatialImportFormat
): SpatialFormatAdapter => adapters[format];

export const getSpatialFormatAdapters = (): SpatialFormatAdapter[] =>
  Object.values(adapters);

/** Plan reference ids are minted in order; a source id may not survive a route. */
export const spatialImportReference = (n: number) => `planned-${n}`;

/** An entry's geometry as the spatial field stores it. */
const toFeatureCollection = (draft: EntryDraft): PlanFeatureCollection => ({
  type: 'FeatureCollection',
  features: draft.geometries.map(geometry => ({
    type: 'Feature',
    geometry,
    properties: null,
  })),
});

/**
 * Turn a spatial file into a Map Collection plan's `recordData`. Every entry is
 * checked, so a file with several problems reports all of them at once.
 */
export const parseSpatialImport = ({
  format,
  source,
  context,
  grouping,
}: {
  format: SpatialImportFormat;
  /**
   * The file's text, or its parsed form: a JSON value for GeoJSON, an XML
   * document for KML.
   */
  source: unknown;
  context: SpatialImportContext;
  grouping?: GroupingStrategy;
}): SpatialImportResult => {
  const parsed = adapters[format].parse(source);
  if (!parsed.ok) return {ok: false, errors: [{message: parsed.message}]};

  const errors: SpatialImportError[] = [];

  // Explode each feature's geometry into the simple geometries a field stores
  const simple: SimpleFeature[] = [];
  for (const feature of parsed.features) {
    const exploded = explodeGeometry(feature.geometry);
    if (!exploded.ok) {
      errors.push({index: feature.index, message: exploded.message});
      continue;
    }
    simple.push({
      index: feature.index,
      geometries: exploded.geometries,
      properties: feature.properties,
    });
  }

  const drafts = groupEntries(simple, grouping);
  const recordData: Record<string, MapCollectionPlanEntry> = {};
  const {template, fieldTypes, spatial} = context;

  drafts.forEach((draft, position) => {
    const index = draft.indices[0];
    let sound = true;

    // The geometry must suit the spatial field it is written to
    if (spatial.featureType) {
      const wrong = draft.geometries.find(g => g.type !== spatial.featureType);
      if (wrong) {
        errors.push({
          index,
          message: `Geometry is a ${wrong.type} but the spatial field takes a ${spatial.featureType}`,
        });
        sound = false;
      }
    }
    if (spatial.componentName === 'TakePoint') {
      if (draft.geometries.some(g => g.type !== 'Point')) {
        errors.push({
          index,
          message:
            'The spatial field is a GPS point, so the geometry must be a Point',
        });
        sound = false;
      } else if (draft.geometries.length !== 1) {
        errors.push({
          index,
          message: `The spatial field holds one point but the feature has ${draft.geometries.length}`,
        });
        sound = false;
      }
    }

    const extracted = extractFields({
      properties: draft.properties,
      recordFields: template.recordFields,
      fieldTypes,
    });
    if (!extracted.ok) {
      extracted.messages.forEach(message => errors.push({index, message}));
      sound = false;
    }
    if (!sound) return;

    const entry: MapCollectionPlanEntry = {
      fields: extracted.ok ? extracted.fields : {},
      spatial: toFeatureCollection(draft),
    };
    const issues = mapCollectionEntryIssues({template, entry});
    if (issues.length > 0) {
      issues.forEach(message => errors.push({index, message}));
      return;
    }
    recordData[spatialImportReference(position + 1)] = entry;
  });

  if (errors.length > 0) return {ok: false, errors};
  return {ok: true, recordData};
};
