/**
 * @file Types of the spatial import pipeline that turns a spatial file into a
 * Map Collection plan's config. Each stage is its own module so a new file
 * format adds an adapter and leaves the rest alone.
 */
import type {PlanGeometry, PlanGeometryType} from '../planGeoJson';
import type {
  MapCollectionPlanEntry,
  MapCollectionPlanTemplate,
} from '../mapCollectionPlan';

/** The file formats the pipeline can read. */
export const SPATIAL_IMPORT_FORMATS = ['geojson', 'kml'] as const;
export type SpatialImportFormat = (typeof SPATIAL_IMPORT_FORMATS)[number];

/**
 * The parts of an XML DOM document the KML adapter reads. Structural, so the
 * browser's DOMParser output and an @xmldom/xmldom document both fit without
 * this library depending on the DOM type library.
 */
export type XmlDocumentLike = {
  documentElement: {localName?: string | null; nodeName: string} | null;
  getElementsByTagName: (name: string) => {length: number};
};

/** A DOMParser-shaped constructor, looked up on `globalThis` when needed. */
export type XmlParserConstructor = new () => {
  parseFromString: (text: string, mimeType: string) => XmlDocumentLike;
};

/**
 * One feature as a format adapter hands it on: a geometry (possibly a Multi*
 * or GeometryCollection, before exploding) and its attributes.
 */
export type NormalizedFeature = {
  /** Position in the source, for error messages. */
  index: number;
  /** Raw GeoJSON-shaped geometry; validated and exploded by the next stage. */
  geometry: unknown;
  properties: Record<string, unknown>;
};

/** A feature whose geometry has been exploded into simple geometries. */
export type SimpleFeature = {
  index: number;
  geometries: PlanGeometry[];
  properties: Record<string, unknown>;
};

/** One planned entry as the pipeline builds it, before validation. */
export type EntryDraft = {
  /** Source indices the entry was grouped from, for error messages. */
  indices: number[];
  geometries: PlanGeometry[];
  properties: Record<string, unknown>;
};

/** What the pipeline needs to know about the plan the file is for. */
export type SpatialImportContext = {
  template: Pick<MapCollectionPlanTemplate, 'recordFields' | 'spatialFieldId'>;
  /** The `type-returned` of each record field, to coerce attribute values. */
  fieldTypes: Record<string, string | undefined>;
  /** The spatial field's component and, for a MapFormField, its feature type. */
  spatial: {
    componentName: string | undefined;
    featureType?: PlanGeometryType;
  };
};

export type SpatialImportError = {
  /** Source feature index the problem was found at, if it belongs to one. */
  index?: number;
  message: string;
};

export type SpatialImportResult =
  | {ok: true; recordData: Record<string, MapCollectionPlanEntry>}
  | {ok: false; errors: SpatialImportError[]};

/** A format adapter: source -> normalized features, or the reason it cannot. */
export type SpatialFormatAdapter = {
  format: SpatialImportFormat;
  label: string;
  /** File extensions and MIME types a picker should accept. */
  accept: string[];
  /**
   * Read a source into features. Every adapter takes the file's text; each
   * also takes its own already-parsed form (a JSON value for GeoJSON, an XML
   * document for KML) so callers that have one need not re-serialise it.
   */
  parse: (
    source: unknown
  ) => {ok: true; features: NormalizedFeature[]} | {ok: false; message: string};
};
