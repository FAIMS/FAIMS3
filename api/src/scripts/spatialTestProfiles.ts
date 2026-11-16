// SPDX-License-Identifier: Apache-2.0
/**
 * Format × geometry-profile × CRS matrix for the spatial test suite,
 * plus raster format × CRS cases from the pinned Sentinel-2 window.
 */
import {
  GEOJSON_TEST_PROFILES,
  sizeToken,
  type GeoJsonTestProfile,
} from './geojsonTestProfiles';
import {
  RASTER_DEFAULT_CRS,
  RASTER_FORMAT_INFO,
  RASTER_FORMATS,
  rasterCompanionFilenames,
  tryParseRasterFormat,
  type RasterFormat,
} from './spatialRasterFormats';
import {
  SPATIAL_FORMATS,
  SPATIAL_FORMAT_INFO,
  WGS84,
  crsSlug,
  formatSupportsCrs,
  parseSpatialFormat,
  type SpatialFormat,
} from './spatialTestFormats';

export type VectorSpatialTestCase = {
  kind: 'vector';
  id: string;
  format: SpatialFormat;
  crs: string;
  profile: GeoJsonTestProfile;
  filename: string;
  companionFilenames: string[];
  description: string;
};

export type RasterSpatialTestCase = {
  kind: 'raster';
  id: string;
  format: RasterFormat;
  crs: string;
  filename: string;
  companionFilenames: string[];
  description: string;
};

export type SpatialTestCase = VectorSpatialTestCase | RasterSpatialTestCase;

export type SpatialCaseFilter = {
  formats?: SpatialFormat[];
  crsList?: string[];
  only?: string[];
};

export type SuiteCaseFilter = {
  vectorFormats?: SpatialFormat[];
  rasterFormats?: RasterFormat[];
  vectorCrsList?: string[];
  rasterCrsList?: string[];
  only?: string[];
  includeVectors?: boolean;
  includeRasters?: boolean;
};

export type ParsedSuiteFormats = {
  vectors: SpatialFormat[];
  rasters: RasterFormat[];
};

export const spatialCaseId = (
  format: SpatialFormat,
  crs: string,
  profileId: string
): string => `${format}-${crsSlug(crs)}-${profileId}`;

export const rasterCaseId = (format: RasterFormat, crs: string): string =>
  `raster-${crsSlug(crs)}-${format}`;

export const spatialCaseFilename = (
  bytes: number,
  format: SpatialFormat,
  crs: string,
  profileId: string
): string =>
  `${sizeToken(bytes)}-${spatialCaseId(format, crs, profileId)}${SPATIAL_FORMAT_INFO[format].uploadExtension}`;

export const rasterCaseFilename = (
  bytes: number,
  format: RasterFormat,
  crs: string
): string =>
  `${sizeToken(bytes)}-${rasterCaseId(format, crs)}${RASTER_FORMAT_INFO[format].uploadExtension}`;

const matchesOnly = (
  only: Set<string> | undefined,
  tokens: string[]
): boolean => {
  if (!only) {
    return true;
  }
  return tokens.some(token => only.has(token));
};

export const buildSpatialTestCases = (
  filter: SpatialCaseFilter = {}
): VectorSpatialTestCase[] => {
  const formats = filter.formats ?? [...SPATIAL_FORMATS];
  const crsList = filter.crsList ?? [WGS84];
  const only = filter.only ? new Set(filter.only) : undefined;
  const cases: VectorSpatialTestCase[] = [];

  for (const format of formats) {
    for (const crs of crsList) {
      if (!formatSupportsCrs(format, crs)) {
        continue;
      }
      for (const profile of GEOJSON_TEST_PROFILES) {
        const id = spatialCaseId(format, crs, profile.id);
        if (!matchesOnly(only, [id, profile.id, format])) {
          continue;
        }
        const info = SPATIAL_FORMAT_INFO[format];
        cases.push({
          kind: 'vector',
          id,
          format,
          crs,
          profile,
          filename: spatialCaseFilename(0, format, crs, profile.id),
          companionFilenames: [],
          description: `${info.id} / ${crs}: ${profile.description} (nesting=${info.nesting})`,
        });
      }
    }
  }

  return cases.map(testCase => ({
    ...testCase,
    filename: '',
  }));
};

export const buildRasterTestCases = (
  filter: {
    formats?: RasterFormat[];
    crsList?: string[];
    only?: string[];
  } = {}
): RasterSpatialTestCase[] => {
  const formats = filter.formats ?? [...RASTER_FORMATS];
  const crsList = filter.crsList ?? [...RASTER_DEFAULT_CRS];
  const only = filter.only ? new Set(filter.only) : undefined;
  const cases: RasterSpatialTestCase[] = [];

  for (const format of formats) {
    for (const crs of crsList) {
      const id = rasterCaseId(format, crs);
      if (!matchesOnly(only, [id, format, 'raster'])) {
        continue;
      }
      const info = RASTER_FORMAT_INFO[format];
      cases.push({
        kind: 'raster',
        id,
        format,
        crs,
        filename: '',
        companionFilenames: [],
        description: `${info.id} / ${crs}: ${info.description}`,
      });
    }
  }
  return cases;
};

export const buildSuiteTestCases = (
  filter: SuiteCaseFilter = {}
): SpatialTestCase[] => {
  const includeVectors = filter.includeVectors ?? true;
  const includeRasters = filter.includeRasters ?? true;
  const cases: SpatialTestCase[] = [];
  if (includeVectors) {
    cases.push(
      ...buildSpatialTestCases({
        formats: filter.vectorFormats,
        crsList: filter.vectorCrsList,
        only: filter.only,
      })
    );
  }
  if (includeRasters) {
    cases.push(
      ...buildRasterTestCases({
        formats: filter.rasterFormats,
        crsList: filter.rasterCrsList,
        only: filter.only,
      })
    );
  }
  return cases;
};

export const parseSuiteFormats = (raw: string): ParsedSuiteFormats => {
  const tokens = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('--formats must list at least one format');
  }
  const vectors: SpatialFormat[] = [];
  const rasters: RasterFormat[] = [];
  for (const token of tokens) {
    const raster = tryParseRasterFormat(token);
    if (raster) {
      rasters.push(raster);
      continue;
    }
    vectors.push(parseSpatialFormat(token));
  }
  return {
    vectors: [...new Set(vectors)],
    rasters: [...new Set(rasters)],
  };
};

export const parseOnlyTokens = (raw: string): string[] => {
  const tokens = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new Error(
      '--only must list at least one profile, format, or case id'
    );
  }
  const formats = new Set<string>([
    ...SPATIAL_FORMATS,
    ...RASTER_FORMATS,
    'raster',
  ]);
  const profiles = new Set(GEOJSON_TEST_PROFILES.map(profile => profile.id));
  const unknown = tokens.filter(token => {
    if (formats.has(token) || profiles.has(token)) {
      return false;
    }
    return (
      !/^(geojson|kml|gpkg|shapefile|gdb)-epsg\d+-/.test(token) &&
      !/^raster-epsg\d+-/.test(token)
    );
  });
  if (unknown.length > 0) {
    throw new Error(
      `Unknown --only token(s): ${unknown.join(', ')}. Use a format, geometry profile id, raster, or case id.`
    );
  }
  return tokens;
};

export const applySizeToCases = (
  cases: SpatialTestCase[],
  sizeBytes: number
): SpatialTestCase[] => applySizesToCases(cases, sizeBytes, sizeBytes);

export const applySizesToCases = (
  cases: SpatialTestCase[],
  vectorBytes: number,
  rasterBytes: number
): SpatialTestCase[] =>
  cases.map(testCase => {
    if (testCase.kind === 'raster') {
      const filename = rasterCaseFilename(
        rasterBytes,
        testCase.format,
        testCase.crs
      );
      return {
        ...testCase,
        filename,
        companionFilenames: rasterCompanionFilenames(filename, testCase.format),
      };
    }
    return {
      ...testCase,
      filename: spatialCaseFilename(
        vectorBytes,
        testCase.format,
        testCase.crs,
        testCase.profile.id
      ),
      companionFilenames: [],
    };
  });
