import {expect} from 'chai';
import {
  buildGeoPackageLayerName,
  geoJsonGeometryTypeToLayerSuffix,
} from '../src/couchdb/export/geospatialExport';

/** Unit tests for GeoPackage layer naming (ogr2ogr table names). */
describe('GeoPackage layer naming', () => {
  it('maps simple and multi geometry types to the same suffix', () => {
    expect(geoJsonGeometryTypeToLayerSuffix('Point')).to.equal('point');
    expect(geoJsonGeometryTypeToLayerSuffix('MultiPoint')).to.equal('point');
    expect(geoJsonGeometryTypeToLayerSuffix('LineString')).to.equal(
      'linestring'
    );
    expect(geoJsonGeometryTypeToLayerSuffix('MultiLineString')).to.equal(
      'linestring'
    );
    expect(geoJsonGeometryTypeToLayerSuffix('Polygon')).to.equal('polygon');
    expect(geoJsonGeometryTypeToLayerSuffix('MultiPolygon')).to.equal(
      'polygon'
    );
  });

  it('returns null for unsupported geometry types', () => {
    expect(geoJsonGeometryTypeToLayerSuffix('GeometryCollection')).to.be.null;
  });

  it('builds layer names as {form_id}_{geometry_type}', () => {
    expect(buildGeoPackageLayerName('damage_assessment', 'Point')).to.equal(
      'damage_assessment_point'
    );
    expect(buildGeoPackageLayerName('access_route', 'LineString')).to.equal(
      'access_route_linestring'
    );
    expect(
      buildGeoPackageLayerName('evacuation_zone', 'MultiPolygon')
    ).to.equal('evacuation_zone_polygon');
  });

  it('sanitises invalid characters in form ids', () => {
    expect(buildGeoPackageLayerName('Campus-Survey', 'Point')).to.equal(
      'Campus_Survey_point'
    );
  });

  it('allocates unique names when sanitisation would collide', () => {
    const usedNames = new Set<string>();
    const first = buildGeoPackageLayerName('a/b', 'Point', usedNames);
    const second = buildGeoPackageLayerName('a-b', 'Point', usedNames);

    expect(first).to.equal('a_b_point');
    expect(second).to.not.equal(first);
    expect(second).to.match(/^a_b_point_\d+$/);
  });
});
