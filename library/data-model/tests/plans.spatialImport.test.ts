import {DOMParser} from '@xmldom/xmldom';
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
  test('lists the geojson and kml adapters', () => {
    expect(getSpatialFormatAdapters().map(a => a.format)).toEqual([
      'geojson',
      'kml',
    ]);
  });

  test('reads geojson from file text too', () => {
    const source = JSON.stringify(
      collection(feature({type: 'Point', coordinates: [1, 2]}, {Name: 'A'}))
    );
    const result = parseSpatialImport({format: 'geojson', source, context});
    expect(result.ok).toBe(true);

    const bad = parseSpatialImport({format: 'geojson', source: '{', context});
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].message).toMatch(/not valid JSON/);
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

describe('spatial import: kml', () => {
  const xml = (text: string) =>
    new DOMParser().parseFromString(text, 'application/xml');

  const kmlDocument = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sites</name>
    ${body}
  </Document>
</kml>`;

  const placemarks = kmlDocument(`
    <Schema name="Site" id="SiteSchema">
      <SimpleField name="Count" type="int"/>
    </Schema>
    <Folder>
      <name>North</name>
      <Placemark id="pm-a">
        <name>A</name>
        <description>First site</description>
        <ExtendedData>
          <Data name="Name"><value>A</value></Data>
          <Data name="Count"><value>3</value></Data>
          <Data name="Ignored"><value>x</value></Data>
        </ExtendedData>
        <Point><coordinates>151.1,-33.8,0</coordinates></Point>
      </Placemark>
    </Folder>
    <Placemark>
      <name>B</name>
      <ExtendedData>
        <SchemaData schemaUrl="#SiteSchema">
          <SimpleData name="Name">B</SimpleData>
          <SimpleData name="Count">4</SimpleData>
        </SchemaData>
      </ExtendedData>
      <MultiGeometry>
        <Point><coordinates>1,1</coordinates></Point>
        <Point><coordinates>2,2</coordinates></Point>
      </MultiGeometry>
    </Placemark>
    <GroundOverlay>
      <name>Aerial</name>
      <LatLonBox><north>1</north><south>0</south><east>1</east><west>0</west></LatLonBox>
    </GroundOverlay>
  `);

  test('turns placemarks into record data, flattening folders in order', () => {
    const result = parseSpatialImport({
      format: 'kml',
      source: xml(placemarks),
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
                // KML altitude is kept as a third ordinate
                geometry: {type: 'Point', coordinates: [151.1, -33.8, 0]},
                properties: null,
              },
            ],
          },
        },
        'planned-2': {
          fields: {Name: 'B', Count: 4},
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

  test('exposes name and description as properties', () => {
    const result = parseSpatialImport({
      format: 'kml',
      source: xml(placemarks),
      context: {
        template: {
          recordFields: [
            {fieldId: 'name', required: true},
            {fieldId: 'description', required: false},
          ],
          spatialFieldId: 'Location',
        },
        fieldTypes: {
          name: 'faims-core::String',
          description: 'faims-core::String',
        },
        spatial: {componentName: 'MapFormField'},
      },
    });
    expect(result.ok && result.recordData['planned-1'].fields).toEqual({
      name: 'A',
      description: 'First site',
    });
    expect(result.ok && result.recordData['planned-2'].fields).toEqual({
      name: 'B',
    });
  });

  test('reads file text through a global DOMParser', () => {
    const globals = globalThis as {DOMParser?: unknown};
    const previous = globals.DOMParser;
    globals.DOMParser = DOMParser;
    try {
      const result = parseSpatialImport({
        format: 'kml',
        source: placemarks,
        context,
      });
      expect(result.ok && Object.keys(result.recordData)).toEqual([
        'planned-1',
        'planned-2',
      ]);

      const notXml = parseSpatialImport({
        format: 'kml',
        source: '<kml><Placemark>',
        context,
      });
      expect(notXml.ok).toBe(false);
      if (!notXml.ok)
        expect(notXml.errors[0].message).toMatch(/not well-formed XML/);
    } finally {
      globals.DOMParser = previous;
    }
  });

  test('explains when no XML parser is available', () => {
    const globals = globalThis as {DOMParser?: unknown};
    const previous = globals.DOMParser;
    delete globals.DOMParser;
    try {
      const result = parseSpatialImport({
        format: 'kml',
        source: placemarks,
        context,
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors[0].message).toMatch(/no XML parser/);
    } finally {
      globals.DOMParser = previous;
    }
  });

  test('rejects non-KML input and placemark-less documents', () => {
    const gpx = parseSpatialImport({
      format: 'kml',
      source: xml('<gpx xmlns="http://www.topografix.com/GPX/1/1"/>'),
      context,
    });
    expect(gpx.ok).toBe(false);
    if (!gpx.ok) expect(gpx.errors[0].message).toMatch(/root element is <gpx>/);

    const empty = parseSpatialImport({
      format: 'kml',
      source: xml(kmlDocument('')),
      context,
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors[0].message).toMatch(/no Placemarks/);

    const json = parseSpatialImport({
      format: 'kml',
      source: {type: 'FeatureCollection', features: []},
      context,
    });
    expect(json.ok).toBe(false);
  });

  test('reports placemark problems by index', () => {
    const result = parseSpatialImport({
      format: 'kml',
      source: xml(
        kmlDocument(`
          <Placemark>
            <ExtendedData><Data name="Name"><value>A</value></Data></ExtendedData>
          </Placemark>
          <Placemark>
            <ExtendedData><Data name="Name"><value>B</value></Data></ExtendedData>
            <LineString><coordinates>0,0 1,1</coordinates></LineString>
          </Placemark>
          <Placemark>
            <ExtendedData><Data name="Count"><value>1</value></Data></ExtendedData>
            <Point><coordinates>0,0</coordinates></Point>
          </Placemark>
        `)
      ),
      context: {
        ...context,
        spatial: {componentName: 'MapFormField', featureType: 'Point'},
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        {index: 0, message: 'Feature has no geometry'},
        {
          index: 1,
          message:
            'Geometry is a LineString but the spatial field takes a Point',
        },
        {index: 2, message: 'Missing required field Name'},
      ]);
    }
  });
});
