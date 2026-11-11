// SPDX-License-Identifier: Apache-2.0
/**
 * Vector formats the map-layer ingest path accepts, and how the test
 * generator should express nesting / CRS in each one.
 */

export const SPATIAL_FORMATS = [
  'geojson',
  'kml',
  'gpkg',
  'shapefile',
  'gdb',
] as const;

export type SpatialFormat = (typeof SPATIAL_FORMATS)[number];

export const WGS84 = 'EPSG:4326';

export type SpatialFormatInfo = {
  id: SpatialFormat;
  /** ogr2ogr -f driver name. */
  ogrDriver: string;
  /** Upload / on-disk extension including the leading dot. */
  uploadExtension: string;
  /**
   * How nesting is represented. `folders` = KML Folder tree.
   * `layers` = one OGR layer of flattened features (GPKG / GDB).
   * `none` = shapefile: flatten and split by geometry family.
   * `feature-collection` = GeoJSON FeatureCollection-in-FeatureCollection.
   */
  nesting: 'feature-collection' | 'folders' | 'layers' | 'none';
  /** False for KML (always lon/lat WGS84). */
  supportsCrs: boolean;
  mediaType: string;
  description: string;
};

export const SPATIAL_FORMAT_INFO: Record<SpatialFormat, SpatialFormatInfo> = {
  geojson: {
    id: 'geojson',
    ogrDriver: 'GeoJSON',
    uploadExtension: '.geojson',
    nesting: 'feature-collection',
    supportsCrs: true,
    mediaType: 'application/geo+json',
    description:
      'RFC 7946 FeatureCollection. Nested mode writes FeatureCollections as features (non-RFC). Non-WGS84 is flattened legacy GeoJSON with a crs member.',
  },
  kml: {
    id: 'kml',
    ogrDriver: 'LIBKML',
    uploadExtension: '.kml',
    nesting: 'folders',
    supportsCrs: false,
    mediaType: 'application/vnd.google-earth.kml+xml',
    description:
      'KML 2.2. Nested FeatureCollections become Folder trees; features become Placemarks. CRS is always WGS84.',
  },
  gpkg: {
    id: 'gpkg',
    ogrDriver: 'GPKG',
    uploadExtension: '.gpkg',
    nesting: 'layers',
    supportsCrs: true,
    mediaType: 'application/geopackage+sqlite3',
    description:
      'GeoPackage. Nesting is flattened to one features layer (collection path kept as an attribute).',
  },
  shapefile: {
    id: 'shapefile',
    ogrDriver: 'ESRI Shapefile',
    uploadExtension: '.zip',
    nesting: 'none',
    supportsCrs: true,
    mediaType: 'application/zip',
    description:
      'Zipped shapefile set. Flattened; mixed geometries become points/lines/polygons shapefiles in one zip. CRS in .prj.',
  },
  gdb: {
    id: 'gdb',
    ogrDriver: 'OpenFileGDB',
    uploadExtension: '.gdb.zip',
    nesting: 'layers',
    supportsCrs: true,
    mediaType: 'application/zip',
    description:
      'Zipped File Geodatabase (Name.gdb/). Nesting flattened to one features layer. OpenFileGDB writer.',
  },
};

export const parseSpatialFormat = (raw: string): SpatialFormat => {
  const value = raw.trim().toLowerCase();
  const aliases: Record<string, SpatialFormat> = {
    geojson: 'geojson',
    json: 'geojson',
    kml: 'kml',
    kmz: 'kml',
    gpkg: 'gpkg',
    geopackage: 'gpkg',
    shapefile: 'shapefile',
    shp: 'shapefile',
    shape: 'shapefile',
    gdb: 'gdb',
    filegdb: 'gdb',
    openfilegdb: 'gdb',
  };
  const format = aliases[value];
  if (!format) {
    throw new Error(
      `Invalid --format '${raw}'. Use geojson, kml, gpkg, shapefile, or gdb.`
    );
  }
  return format;
};

export const parseSpatialFormats = (raw: string): SpatialFormat[] => {
  const formats = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(parseSpatialFormat);
  if (formats.length === 0) {
    throw new Error('--formats must list at least one format');
  }
  return [...new Set(formats)];
};

/** Normalise EPSG:4326 / 4326 / WGS84 (and similar) to `EPSG:n`. */
export const parseCrs = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    throw new Error('CRS must not be empty');
  }
  const lower = value.toLowerCase();
  if (lower === 'wgs84' || lower === 'crs84') {
    return WGS84;
  }
  if (lower === 'webmercator' || lower === 'web-mercator') {
    return 'EPSG:3857';
  }
  const match = value.match(/^(?:epsg:)?(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid --crs '${raw}'. Use EPSG:4326, 3857, or WGS84.`);
  }
  return `EPSG:${match[1]}`;
};

export const parseCrsList = (raw: string): string[] => {
  const list = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(parseCrs);
  if (list.length === 0) {
    throw new Error('--crs must list at least one CRS');
  }
  return [...new Set(list)];
};

export const isWgs84 = (crs: string): boolean => parseCrs(crs) === WGS84;

export const crsSlug = (crs: string): string =>
  parseCrs(crs).toLowerCase().replace(':', '');

export const formatSupportsCrs = (
  format: SpatialFormat,
  crs: string
): boolean => {
  if (isWgs84(crs)) {
    return true;
  }
  return SPATIAL_FORMAT_INFO[format].supportsCrs;
};

export const defaultOutputPath = (format: SpatialFormat): string =>
  `example${SPATIAL_FORMAT_INFO[format].uploadExtension}`;
