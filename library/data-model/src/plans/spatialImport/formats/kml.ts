/**
 * @file KML adapter: one Placemark per planned entry, given as file text or
 * an already-parsed XML document. Conversion to GeoJSON is done by
 * `@tmcw/togeojson`, so Folders and Documents are flattened in document
 * order, a MultiGeometry becomes a GeometryCollection (exploded by the next
 * stage), and a Placemark's `<name>`, `<description>` and `<ExtendedData>`
 * (`<Data name>` / `<SchemaData><SimpleData name>`) become properties keyed
 * by that name. GroundOverlays and NetworkLinks are not planned records and
 * are dropped.
 *
 * XML parsing needs a DOMParser. Browsers have one; in Node the caller either
 * passes a document (e.g. from `@xmldom/xmldom`) or installs a DOMParser on
 * `globalThis`.
 */
import {kml} from '@tmcw/togeojson';
import type {
  NormalizedFeature,
  SpatialFormatAdapter,
  XmlDocumentLike,
  XmlParserConstructor,
} from '../types';

const isXmlDocument = (source: unknown): source is XmlDocumentLike =>
  typeof source === 'object' &&
  source !== null &&
  'documentElement' in source &&
  typeof (source as {getElementsByTagName?: unknown}).getElementsByTagName ===
    'function';

/** Parse XML text with whatever DOMParser the environment provides. */
const parseXml = (
  text: string
): {ok: true; document: XmlDocumentLike} | {ok: false; message: string} => {
  const Parser = (globalThis as {DOMParser?: XmlParserConstructor}).DOMParser;
  if (!Parser) {
    return {
      ok: false,
      message: 'KML cannot be read here: no XML parser is available',
    };
  }
  let document: XmlDocumentLike;
  try {
    document = new Parser().parseFromString(text, 'application/xml');
  } catch {
    return {ok: false, message: 'The file is not well-formed XML'};
  }
  // Browsers report XML errors as a <parsererror> element in the result
  if (document.getElementsByTagName('parsererror').length > 0) {
    return {ok: false, message: 'The file is not well-formed XML'};
  }
  return {ok: true, document};
};

/** The root element's local name, e.g. "kml" for `<kml xmlns=...>`. */
const rootName = (document: XmlDocumentLike): string | undefined => {
  const root = document.documentElement;
  if (!root) return undefined;
  return (root.localName ?? root.nodeName.split(':').pop()) || undefined;
};

/** KML format adapter: Placemark text or a parsed XML document to normalised features. */
export const kmlAdapter: SpatialFormatAdapter = {
  format: 'kml',
  label: 'KML',
  accept: ['.kml', 'application/vnd.google-earth.kml+xml'],
  parse: source => {
    let document: XmlDocumentLike;
    if (typeof source === 'string') {
      const parsed = parseXml(source);
      if (!parsed.ok) return parsed;
      document = parsed.document;
    } else if (isXmlDocument(source)) {
      document = source;
    } else {
      return {ok: false, message: 'The file is not a KML document'};
    }

    const root = rootName(document);
    if (root !== 'kml') {
      return {
        ok: false,
        message: root
          ? `The file is not a KML document (its root element is <${root}>)`
          : 'The file is not a KML document',
      };
    }

    // togeojson's own signature names the DOM `Document` type; this library
    // is built without the DOM lib, so the structural document is cast.
    const collection = kml(document as Parameters<typeof kml>[0]);
    const features: NormalizedFeature[] = [];
    for (const feature of collection.features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      // GroundOverlay and NetworkLink features are tagged by togeojson
      if (properties['@geometry-type'] !== undefined) continue;
      features.push({
        index: features.length,
        geometry: feature.geometry,
        properties,
      });
    }
    if (features.length === 0) {
      return {ok: false, message: 'The KML has no Placemarks'};
    }
    return {ok: true, features};
  },
};
