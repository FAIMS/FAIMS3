// SPDX-License-Identifier: Apache-2.0
/**
 * Format × geometry-profile × CRS matrix for the spatial test suite.
 */
import {
  GEOJSON_TEST_PROFILES,
  sizeToken,
  type GeoJsonTestProfile,
} from './geojsonTestProfiles';
import {
  SPATIAL_FORMATS,
  SPATIAL_FORMAT_INFO,
  WGS84,
  crsSlug,
  formatSupportsCrs,
  type SpatialFormat,
} from './spatialTestFormats';

export type SpatialTestCase = {
  id: string;
  format: SpatialFormat;
  crs: string;
  profile: GeoJsonTestProfile;
  filename: string;
  description: string;
};

export type SpatialCaseFilter = {
  formats?: SpatialFormat[];
  crsList?: string[];
  only?: string[];
};

export const spatialCaseId = (
  format: SpatialFormat,
  crs: string,
  profileId: string
): string => `${format}-${crsSlug(crs)}-${profileId}`;

export const spatialCaseFilename = (
  bytes: number,
  format: SpatialFormat,
  crs: string,
  profileId: string
): string =>
  `${sizeToken(bytes)}-${spatialCaseId(format, crs, profileId)}${SPATIAL_FORMAT_INFO[format].uploadExtension}`;

export const buildSpatialTestCases = (
  filter: SpatialCaseFilter = {}
): SpatialTestCase[] => {
  const formats = filter.formats ?? [...SPATIAL_FORMATS];
  const crsList = filter.crsList ?? [WGS84];
  const only = filter.only ? new Set(filter.only) : undefined;
  const cases: SpatialTestCase[] = [];

  for (const format of formats) {
    for (const crs of crsList) {
      if (!formatSupportsCrs(format, crs)) {
        continue;
      }
      for (const profile of GEOJSON_TEST_PROFILES) {
        const id = spatialCaseId(format, crs, profile.id);
        if (
          only &&
          !only.has(id) &&
          !only.has(profile.id) &&
          !only.has(format)
        ) {
          continue;
        }
        const info = SPATIAL_FORMAT_INFO[format];
        cases.push({
          id,
          format,
          crs,
          profile,
          filename: spatialCaseFilename(0, format, crs, profile.id),
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
  const formats = new Set<string>(SPATIAL_FORMATS);
  const profiles = new Set(GEOJSON_TEST_PROFILES.map(profile => profile.id));
  const unknown = tokens.filter(token => {
    if (formats.has(token) || profiles.has(token)) {
      return false;
    }
    return !/^(geojson|kml|gpkg|shapefile|gdb)-epsg\d+-/.test(token);
  });
  if (unknown.length > 0) {
    throw new Error(
      `Unknown --only token(s): ${unknown.join(', ')}. Use a format, geometry profile id, or case id.`
    );
  }
  return tokens;
};

export const applySizeToCases = (
  cases: SpatialTestCase[],
  sizeBytes: number
): SpatialTestCase[] =>
  cases.map(testCase => ({
    ...testCase,
    filename: spatialCaseFilename(
      sizeBytes,
      testCase.format,
      testCase.crs,
      testCase.profile.id
    ),
  }));
