// SPDX-License-Identifier: Apache-2.0
/**
 * Raster formats the map-layer ingest path accepts, and the companion
 * files PNG/JPEG need (world file + .prj).
 */

export const RASTER_FORMATS = ['geotiff', 'jpeg', 'png', 'pdf'] as const;

export type RasterFormat = (typeof RASTER_FORMATS)[number];

/** Default CRS set for satellite fixtures (WGS84, Web Mercator, GDA94 MGA56). */
export const RASTER_DEFAULT_CRS = [
  'EPSG:4326',
  'EPSG:3857',
  'EPSG:28356',
] as const;

export type RasterFormatInfo = {
  id: RasterFormat;
  gdalDriver: string;
  uploadExtension: string;
  /** Extra files uploaded beside the primary (same basename). */
  companionExtensions: readonly string[];
  mediaType: string;
  description: string;
};

export const RASTER_FORMAT_INFO: Record<RasterFormat, RasterFormatInfo> = {
  geotiff: {
    id: 'geotiff',
    gdalDriver: 'GTiff',
    uploadExtension: '.tif',
    companionExtensions: [],
    mediaType: 'image/tiff',
    description:
      'GeoTIFF with embedded georeferencing. CRS is inside the file.',
  },
  jpeg: {
    id: 'jpeg',
    gdalDriver: 'JPEG',
    uploadExtension: '.jpg',
    companionExtensions: ['.jgw', '.prj'],
    mediaType: 'image/jpeg',
    description:
      'JPEG plus ESRI world file (.jgw) and .prj. Ingest requires both companions.',
  },
  png: {
    id: 'png',
    gdalDriver: 'PNG',
    uploadExtension: '.png',
    companionExtensions: ['.pgw', '.prj'],
    mediaType: 'image/png',
    description:
      'PNG plus ESRI world file (.pgw) and .prj. Ingest requires both companions.',
  },
  pdf: {
    id: 'pdf',
    gdalDriver: 'PDF',
    uploadExtension: '.pdf',
    companionExtensions: [],
    mediaType: 'application/pdf',
    description: 'Geospatial PDF with an embedded geotransform and CRS.',
  },
};

const RASTER_ALIASES: Record<string, RasterFormat> = {
  geotiff: 'geotiff',
  tif: 'geotiff',
  tiff: 'geotiff',
  gtiff: 'geotiff',
  jpeg: 'jpeg',
  jpg: 'jpeg',
  png: 'png',
  pdf: 'pdf',
  geospatialpdf: 'pdf',
};

export const parseRasterFormat = (raw: string): RasterFormat => {
  const format = RASTER_ALIASES[raw.trim().toLowerCase()];
  if (!format) {
    throw new Error(
      `Invalid raster format '${raw}'. Use geotiff, jpeg, png, or pdf.`
    );
  }
  return format;
};

export const tryParseRasterFormat = (raw: string): RasterFormat | undefined => {
  return RASTER_ALIASES[raw.trim().toLowerCase()];
};

export const parseRasterFormats = (raw: string): RasterFormat[] => {
  const formats = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(parseRasterFormat);
  if (formats.length === 0) {
    throw new Error('--formats must list at least one raster format');
  }
  return [...new Set(formats)];
};

export const rasterCompanionFilenames = (
  primaryFilename: string,
  format: RasterFormat
): string[] => {
  const ext = RASTER_FORMAT_INFO[format].uploadExtension;
  if (!primaryFilename.toLowerCase().endsWith(ext)) {
    throw new Error(
      `Raster primary '${primaryFilename}' does not end with ${ext}`
    );
  }
  const stem = primaryFilename.slice(0, -ext.length);
  return RASTER_FORMAT_INFO[format].companionExtensions.map(
    companion => `${stem}${companion}`
  );
};
