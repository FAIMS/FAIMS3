// SPDX-License-Identifier: Apache-2.0
/**
 * Shared GeoJSON test-suite profiles used by the zip builder and the
 * map-layer upload script.
 */
import {type CliArgs} from './exampleGeoJSONGenerator';

export type GeoJsonTestProfile = {
  id: string;
  description: string;
  options: Partial<CliArgs>;
};

/** Profiled GeoJSON variants used for GDAL / tippecanoe / parser coverage. */
export const GEOJSON_TEST_PROFILES: GeoJsonTestProfile[] = [
  {
    id: 'nested-mixed-attrs',
    description:
      'Nested FeatureCollections, mixed geometries, mixed attributes, Multi* and GeometryCollection',
    options: {
      structure: 'nested',
      geometry: 'mixed',
      attributeMode: 'mixed',
      attributes: 12,
      multi: true,
      geometryCollections: true,
      seed: 1,
    },
  },
  {
    id: 'nested-grouped',
    description:
      'Nested collections grouped by geometry (point / line / polygon children), consistent attributes',
    options: {
      structure: 'nested',
      geometry: 'mixed',
      groupByGeometry: true,
      attributeMode: 'consistent',
      attributes: 8,
      seed: 2,
    },
  },
  {
    id: 'nested-depth3-z',
    description:
      'Three-level nested collections, mixed geometries, 3D coordinates',
    options: {
      structure: 'nested',
      nestingDepth: 3,
      geometry: 'mixed',
      attributeMode: 'mixed',
      attributes: 12,
      withZ: true,
      seed: 3,
    },
  },
  {
    id: 'flat-mixed-consistent',
    description:
      'Single FeatureCollection, mixed geometries, consistent attributes, per-feature bbox',
    options: {
      structure: 'flat',
      geometry: 'mixed',
      attributeMode: 'consistent',
      attributes: 8,
      includeBbox: true,
      seed: 4,
    },
  },
  {
    id: 'flat-points',
    description: 'Flat point (dot) layer with a fixed attribute schema',
    options: {
      structure: 'flat',
      geometry: 'point',
      attributeMode: 'consistent',
      attributes: 6,
      seed: 5,
    },
  },
  {
    id: 'flat-lines',
    description: 'Flat LineString layer, longer vertices, mixed attributes',
    options: {
      structure: 'flat',
      geometry: 'line',
      vertices: 16,
      attributeMode: 'mixed',
      attributes: 10,
      seed: 6,
    },
  },
  {
    id: 'flat-polygons',
    description: 'Flat Polygon layer with a fixed attribute schema',
    options: {
      structure: 'flat',
      geometry: 'polygon',
      vertices: 12,
      attributeMode: 'consistent',
      attributes: 8,
      seed: 7,
    },
  },
  {
    id: 'nested-points-multi',
    description:
      'Nested point collections with MultiPoint features sprinkled in',
    options: {
      structure: 'nested',
      geometry: 'point',
      multi: true,
      attributeMode: 'mixed',
      attributes: 12,
      seed: 8,
    },
  },
];

export const sizeToken = (bytes: number): string => {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)}mb`;
  }
  if (bytes % 1024 === 0) {
    return `${bytes / 1024}kb`;
  }
  return `${bytes}b`;
};

export const profileFilename = (bytes: number, profileId: string): string =>
  `${sizeToken(bytes)}-${profileId}.geojson`;

export const parseProfileIds = (raw: string): string[] => {
  const ids = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    throw new Error('--only must list at least one profile id');
  }
  const known = new Set(GEOJSON_TEST_PROFILES.map(profile => profile.id));
  const unknown = ids.filter(id => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown profile(s): ${unknown.join(', ')}. Use --list to see ids.`
    );
  }
  return ids;
};

export const selectedProfiles = (
  only: string[] | undefined
): GeoJsonTestProfile[] => {
  if (!only) {
    return GEOJSON_TEST_PROFILES;
  }
  const wanted = new Set(only);
  return GEOJSON_TEST_PROFILES.filter(profile => wanted.has(profile.id));
};
