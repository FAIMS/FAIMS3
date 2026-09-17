import {explodeGeometry} from '../src/plans/spatialImport/explodeGeometry';
import {coerceFieldValue} from '../src/plans/spatialImport/extractFields';
import {
  getSpatialFormatAdapters,
  parseSpatialImport,
} from '../src/plans/spatialImport/pipeline';
import type {SpatialImportContext} from '../src/plans/spatialImport/types';

const context: SpatialImportContext = {
  template: {
    recordFields: [
      {fieldId: 'Name', required: true},
      {fieldId: 'Count', required: false},
      {fieldId: 'Flag', required: false},
    ],
    spatialFieldId: 'Location',
  },
  fieldTypes: {
    Name: 'faims-core::String',
    Count: 'faims-core::Integer',
    Flag: 'faims-core::Bool',
  },
  spatial: {componentName: 'MapFormField'},
};

const feature = (
  geometry: unknown,
  properties: Record<string, unknown> | null
) => ({
  type: 'Feature',
  geometry,
  properties,
});
const collection = (...features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
});

describe('spatial import: explode geometry', () => {
  test('a simple geometry is returned as is', () => {
    const result = explodeGeometry({type: 'Point', coordinates: [1, 2]});
    expect(result).toEqual({
      ok: true,
      geometries: [{type: 'Point', coordinates: [1, 2]}],
    });
  });

  test('multi geometries become one simple geometry per part', () => {
    const result = explodeGeometry({
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ],
    });
    expect(result.ok && result.geometries.map(g => g.type)).toEqual([
      'LineString',
      'LineString',
    ]);
  });

  test('a geometry collection is exploded recursively', () => {
    const result = explodeGeometry({
      type: 'GeometryCollection',
      geometries: [
        {type: 'Point', coordinates: [0, 0]},
        {
          type: 'MultiPoint',
          coordinates: [
            [1, 1],
            [2, 2],
          ],
        },
      ],
    });
    expect(result.ok && result.geometries).toHaveLength(3);
  });

  test('missing and malformed geometry are rejected', () => {
    expect(explodeGeometry(null).ok).toBe(false);
    expect(explodeGeometry({type: 'Point', coordinates: [1]}).ok).toBe(false);
    expect(explodeGeometry({type: 'Circle', coordinates: [1, 2]}).ok).toBe(
      false
    );
  });
});

describe('spatial import: field coercion', () => {
  test('coerces to the returned type', () => {
    expect(coerceFieldValue('12', 'faims-core::Integer')).toEqual({
      ok: true,
      value: 12,
    });
    expect(coerceFieldValue('1.5', 'faims-core::Number')).toEqual({
      ok: true,
      value: 1.5,
    });
    expect(coerceFieldValue('yes', 'faims-core::Bool')).toEqual({
      ok: true,
      value: true,
    });
    expect(coerceFieldValue(3, 'faims-core::String')).toEqual({
      ok: true,
      value: '3',
    });
  });

  test('absent values are left undefined and bad ones reported', () => {
    expect(coerceFieldValue('', 'faims-core::Integer')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(coerceFieldValue('1.5', 'faims-core::Integer').ok).toBe(false);
    expect(coerceFieldValue('maybe', 'faims-core::Bool').ok).toBe(false);
  });
});

describe('spatial import: pipeline', () => {
  test('lists the geojson adapter', () => {
    expect(getSpatialFormatAdapters().map(a => a.format)).toEqual(['geojson']);
  });

  test('turns a feature collection into record data, one entry per feature', () => {
    const result = parseSpatialImport({
      format: 'geojson',
      source: collection(
        feature(
          {type: 'Point', coordinates: [151, -33]},
          {Name: 'A', Count: '3', Ignored: 1}
        ),
        feature(
          {
            type: 'MultiPoint',
            coordinates: [
              [1, 1],
              [2, 2],
            ],
          },
          {Name: 'B', Flag: 'no'}
        )
      ),
      context,
    });
    expect(result).toEqual({
      ok: true,
      recordData: {
        'planned-1': {
          fields: {Name: 'A', Count: 3},
          spatial: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [151, -33]},
                properties: null,
              },
            ],
          },
        },
        'planned-2': {
          fields: {Name: 'B', Flag: false},
          spatial: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [1, 1]},
                properties: null,
              },
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [2, 2]},
                properties: null,
              },
            ],
          },
        },
      },
    });
  });

  test('rejects non-collections and empty collections', () => {
    expect(
      parseSpatialImport({
        format: 'geojson',
        source: feature(null, null),
        context,
      }).ok
    ).toBe(false);
    expect(
      parseSpatialImport({format: 'geojson', source: {a: 1}, context}).ok
    ).toBe(false);
    expect(
      parseSpatialImport({format: 'geojson', source: collection(), context}).ok
    ).toBe(false);
  });

  test('reports every problem, by feature index', () => {
    const result = parseSpatialImport({
      format: 'geojson',
      source: collection(
        feature({type: 'Point', coordinates: [0, 0]}, {Count: 1}), // no Name
        feature(null, {Name: 'B'}), // no geometry
        feature({type: 'Point', coordinates: [0, 0]}, {Name: 'C', Count: 'x'}) // bad Count
      ),
      context,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(e => e.index)).toEqual([1, 0, 2]);
      expect(result.errors[1].message).toMatch(/Missing required field Name/);
    }
  });

  test('checks geometry against the spatial field', () => {
    const line = feature(
      {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      {Name: 'A'}
    );
    const pointField = parseSpatialImport({
      format: 'geojson',
      source: collection(line),
      context: {
        ...context,
        spatial: {componentName: 'MapFormField', featureType: 'Point'},
      },
    });
    expect(pointField.ok).toBe(false);
    if (!pointField.ok)
      expect(pointField.errors[0].message).toMatch(/takes a Point/);

    const takePointMany = parseSpatialImport({
      format: 'geojson',
      source: collection(
        feature(
          {
            type: 'MultiPoint',
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          {Name: 'A'}
        )
      ),
      context: {...context, spatial: {componentName: 'TakePoint'}},
    });
    expect(takePointMany.ok).toBe(false);
    if (!takePointMany.ok)
      expect(takePointMany.errors[0].message).toMatch(/holds one point/);

    const takePointLine = parseSpatialImport({
      format: 'geojson',
      source: collection(line),
      context: {...context, spatial: {componentName: 'TakePoint'}},
    });
    expect(takePointLine.ok).toBe(false);
  });
});
