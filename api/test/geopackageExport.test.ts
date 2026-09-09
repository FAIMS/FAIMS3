import {describe, expect, it} from 'vitest';
import {
  buildGeoPackageLayerName,
  geoJsonGeometryTypeToLayerSuffix,
} from '../src/couchdb/export/geospatialExport';

/** Unit tests for GeoPackage layer naming (ogr2ogr table names). */
describe('GeoPackage layer naming', () => {
  it('maps simple and multi geometry types to the same suffix', () => {
    expect(geoJsonGeometryTypeToLayerSuffix('Point')).toBe('point');
    expect(geoJsonGeometryTypeToLayerSuffix('MultiPoint')).toBe('point');
    expect(geoJsonGeometryTypeToLayerSuffix('LineString')).toBe('linestring');
    expect(geoJsonGeometryTypeToLayerSuffix('MultiLineString')).toBe(
      'linestring'
    );
    expect(geoJsonGeometryTypeToLayerSuffix('Polygon')).toBe('polygon');
    expect(geoJsonGeometryTypeToLayerSuffix('MultiPolygon')).toBe('polygon');
  });

  it('returns null for unsupported geometry types', () => {
    expect(geoJsonGeometryTypeToLayerSuffix('GeometryCollection')).toBeNull();
  });

  it('builds layer names as {form_id}_{geometry_type}', () => {
    expect(buildGeoPackageLayerName('damage_assessment', 'Point')).toBe(
      'damage_assessment_point'
    );
    expect(buildGeoPackageLayerName('access_route', 'LineString')).toBe(
      'access_route_linestring'
    );
    expect(buildGeoPackageLayerName('evacuation_zone', 'MultiPolygon')).toBe(
      'evacuation_zone_polygon'
    );
  });

  it('sanitises invalid characters in form ids', () => {
    expect(buildGeoPackageLayerName('Campus-Survey', 'Point')).toBe(
      'Campus_Survey_point'
    );
  });

  it('allocates unique names when sanitisation would collide', () => {
    const usedNames = new Set<string>();
    const first = buildGeoPackageLayerName('a/b', 'Point', usedNames);
    const second = buildGeoPackageLayerName('a-b', 'Point', usedNames);

    expect(first).toBe('a_b_point');
    expect(second).not.toBe(first);
    expect(second).toMatch(/^a_b_point_\d+$/);
  });
});
