// SPDX-License-Identifier: Apache-2.0
/**
 * Turn generated (possibly nested) GeoJSON into an ingest-ready spatial file.
 *
 * Nesting is format-specific:
 * - GeoJSON WGS84: leave the FeatureCollection tree as written
 * - KML: FeatureCollections become <Folder>, Features become <Placemark>
 * - GPKG / GDB: flatten to one `features` layer (collection path as a field)
 * - Shapefile: flatten, split by geometry family, zip
 *
 * Coordinates are generated in WGS84. Non-WGS84 outputs are reprojected with
 * ogr2ogr (`-s_srs EPSG:4326 -t_srs <crs>`).
 */
import archiver from 'archiver';
import {spawn} from 'child_process';
import {randomUUID} from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {finished} from 'stream/promises';
import {
  SPATIAL_FORMAT_INFO,
  WGS84,
  isWgs84,
  type SpatialFormat,
} from './spatialTestFormats';

const runOgr2ogr = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn('ogr2ogr', args);
    let stderr = '';
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `ogr2ogr failed (exit ${code ?? 'signal'}): ${stderr.trim() || 'no error output'}`
        )
      );
    });
  });

export type ConvertSpatialOptions = {
  inputGeoJson: string;
  output: string;
  format: SpatialFormat;
  crs: string;
  name: string;
};

const log = (...args: unknown[]): void => {
  console.error('[spatial-convert]', ...args);
};

const tempPath = (suffix: string): string =>
  path.join(os.tmpdir(), `faims-spatial-${randomUUID()}${suffix}`);

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (filePath: string): Promise<unknown> =>
  JSON.parse(await fs.promises.readFile(filePath, 'utf8'));

const collectFeatures = (
  node: unknown,
  out: JsonObject[],
  collectionPath: string
): void => {
  if (!isObject(node)) {
    return;
  }
  if (node.type === 'Feature' && node.geometry) {
    const properties = isObject(node.properties) ? {...node.properties} : {};
    if (collectionPath) {
      properties.collection = collectionPath;
    }
    out.push({...node, properties});
    return;
  }
  if (node.type === 'FeatureCollection' && Array.isArray(node.features)) {
    const name =
      typeof node.name === 'string' && node.name.length > 0
        ? node.name
        : collectionPath;
    for (const child of node.features) {
      collectFeatures(child, out, name);
    }
  }
};

const writeFlatGeoJson = async (
  inputGeoJson: string,
  outputGeoJson: string
): Promise<number> => {
  const root = await readJson(inputGeoJson);
  const features: JsonObject[] = [];
  collectFeatures(root, features, '');
  await fs.promises.writeFile(
    outputGeoJson,
    JSON.stringify({type: 'FeatureCollection', features})
  );
  return features.length;
};

const coordPair = (position: unknown): string | undefined => {
  if (!Array.isArray(position) || typeof position[0] !== 'number') {
    return undefined;
  }
  const lon = position[0];
  const lat = position[1];
  if (typeof lat !== 'number') {
    return undefined;
  }
  if (typeof position[2] === 'number') {
    return `${lon},${lat},${position[2]}`;
  }
  return `${lon},${lat}`;
};

const coordRing = (ring: unknown): string => {
  if (!Array.isArray(ring)) {
    return '';
  }
  return ring.map(coordPair).filter(Boolean).join(' ');
};

const kmlGeometry = (geometry: unknown): string => {
  if (!isObject(geometry) || typeof geometry.type !== 'string') {
    return '';
  }
  const type = geometry.type;
  const coordinates = geometry.coordinates;
  if (type === 'Point') {
    const pair = coordPair(coordinates);
    return pair ? `<Point><coordinates>${pair}</coordinates></Point>` : '';
  }
  if (type === 'MultiPoint' && Array.isArray(coordinates)) {
    const members = coordinates
      .map(coordPair)
      .filter(Boolean)
      .map(pair => `<Point><coordinates>${pair}</coordinates></Point>`)
      .join('');
    return members ? `<MultiGeometry>${members}</MultiGeometry>` : '';
  }
  if (type === 'LineString') {
    const line = coordRing(coordinates);
    return line
      ? `<LineString><coordinates>${line}</coordinates></LineString>`
      : '';
  }
  if (type === 'MultiLineString' && Array.isArray(coordinates)) {
    const members = coordinates
      .map(coordRing)
      .filter(Boolean)
      .map(
        line => `<LineString><coordinates>${line}</coordinates></LineString>`
      )
      .join('');
    return members ? `<MultiGeometry>${members}</MultiGeometry>` : '';
  }
  if (type === 'Polygon' && Array.isArray(coordinates)) {
    const outer = coordRing(coordinates[0]);
    if (!outer) {
      return '';
    }
    const holes = coordinates
      .slice(1)
      .map(coordRing)
      .filter(Boolean)
      .map(
        ring =>
          `<innerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></innerBoundaryIs>`
      )
      .join('');
    return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs>${holes}</Polygon>`;
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    const members = coordinates
      .map(polygon => kmlGeometry({type: 'Polygon', coordinates: polygon}))
      .filter(Boolean)
      .join('');
    return members ? `<MultiGeometry>${members}</MultiGeometry>` : '';
  }
  if (type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    const members = geometry.geometries
      .map(kmlGeometry)
      .filter(Boolean)
      .join('');
    return members ? `<MultiGeometry>${members}</MultiGeometry>` : '';
  }
  return '';
};

const writeKmlNode = (node: unknown, chunks: string[], depth: number): void => {
  if (!isObject(node)) {
    return;
  }
  if (node.type === 'Feature') {
    const geometry = kmlGeometry(node.geometry);
    if (!geometry) {
      return;
    }
    const properties = isObject(node.properties) ? node.properties : {};
    const name =
      typeof properties.name === 'string'
        ? properties.name
        : typeof node.id === 'string'
          ? node.id
          : 'feature';
    chunks.push(
      `<Placemark><name>${xmlEscape(name)}</name>${geometry}</Placemark>`
    );
    return;
  }
  if (node.type === 'FeatureCollection' && Array.isArray(node.features)) {
    const name =
      typeof node.name === 'string' && node.name.length > 0
        ? node.name
        : `collection-${depth}`;
    chunks.push(`<Folder><name>${xmlEscape(name)}</name>`);
    for (const child of node.features) {
      writeKmlNode(child, chunks, depth + 1);
    }
    chunks.push('</Folder>');
  }
};

const writeNestedKml = async (
  inputGeoJson: string,
  outputKml: string
): Promise<void> => {
  const root = await readJson(inputGeoJson);
  const chunks = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
  ];
  writeKmlNode(root, chunks, 0);
  chunks.push('</Document></kml>');
  await fs.promises.writeFile(outputKml, chunks.join(''), 'utf8');
};

const ogr2ogr = (args: string[]): Promise<void> => runOgr2ogr(args);

const reprojectFlatGeoJson = async (
  inputGeoJson: string,
  outputGeoJson: string,
  crs: string
): Promise<void> => {
  await ogr2ogr([
    '-f',
    'GeoJSON',
    '-s_srs',
    WGS84,
    '-t_srs',
    crs,
    '-lco',
    'RFC7946=NO',
    '-nln',
    'features',
    outputGeoJson,
    inputGeoJson,
  ]);
};

const writeGpkg = async (
  flatGeoJson: string,
  output: string,
  crs: string
): Promise<void> => {
  await fs.promises.rm(output, {force: true});
  await ogr2ogr([
    '-f',
    'GPKG',
    '-s_srs',
    WGS84,
    '-t_srs',
    crs,
    '-nln',
    'features',
    output,
    flatGeoJson,
  ]);
};

const writeGdbZip = async (
  flatGeoJson: string,
  outputZip: string,
  crs: string,
  name: string
): Promise<void> => {
  const work = tempPath('');
  await fs.promises.mkdir(work, {recursive: true});
  const gdbName = `${safeBase(name)}.gdb`;
  const gdbPath = path.join(work, gdbName);
  try {
    await ogr2ogr([
      '-f',
      'OpenFileGDB',
      '-s_srs',
      WGS84,
      '-t_srs',
      crs,
      '-nln',
      'features',
      gdbPath,
      flatGeoJson,
    ]);
    await zipDirectory(gdbPath, outputZip, gdbName);
  } finally {
    await fs.promises.rm(work, {recursive: true, force: true});
  }
};

const SHAPE_LAYERS: Array<{
  layer: string;
  where: string;
}> = [
  {
    layer: 'points',
    where: "OGR_GEOMETRY='Point' OR OGR_GEOMETRY='MultiPoint'",
  },
  {
    layer: 'lines',
    where: "OGR_GEOMETRY='LineString' OR OGR_GEOMETRY='MultiLineString'",
  },
  {
    layer: 'polygons',
    where: "OGR_GEOMETRY='Polygon' OR OGR_GEOMETRY='MultiPolygon'",
  },
];

const writeShapefileZip = async (
  flatGeoJson: string,
  outputZip: string,
  crs: string
): Promise<void> => {
  const work = tempPath('-shp');
  await fs.promises.mkdir(work, {recursive: true});
  let written = 0;
  try {
    for (const layer of SHAPE_LAYERS) {
      const shp = path.join(work, `${layer.layer}.shp`);
      try {
        await ogr2ogr([
          '-f',
          'ESRI Shapefile',
          '-s_srs',
          WGS84,
          '-t_srs',
          crs,
          '-where',
          layer.where,
          shp,
          flatGeoJson,
        ]);
        written += 1;
      } catch (err) {
        log(
          `shapefile ${layer.layer} skipped: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    if (written === 0) {
      throw new Error('Shapefile conversion wrote no geometry layers');
    }
    await zipDirectory(work, outputZip, false);
  } finally {
    await fs.promises.rm(work, {recursive: true, force: true});
  }
};

const safeBase = (name: string): string => {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 40) : 'layer';
};

const zipDirectory = async (
  source: string,
  zipPath: string,
  archiveRoot: string | false
): Promise<void> => {
  await fs.promises.mkdir(path.dirname(zipPath), {recursive: true});
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {zlib: {level: 6}});
  archive.on('warning', err => {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  });
  archive.pipe(output);
  const rootName =
    archiveRoot === false ? false : (archiveRoot ?? path.basename(source));
  if (rootName === false) {
    archive.directory(source, false);
  } else {
    archive.directory(source, rootName);
  }
  const done = finished(output);
  await archive.finalize();
  await done;
};

/**
 * Convert generated WGS84 GeoJSON into the requested ingest format / CRS.
 */
export const convertGeneratedSpatial = async (
  options: ConvertSpatialOptions
): Promise<{bytes: number; output: string}> => {
  const format = options.format;
  const crs = options.crs;
  const info = SPATIAL_FORMAT_INFO[format];
  await fs.promises.mkdir(path.dirname(options.output), {recursive: true});

  if (format === 'kml') {
    if (!isWgs84(crs)) {
      log(`KML is WGS84-only; ignoring --crs ${crs}`);
    }
    await writeNestedKml(options.inputGeoJson, options.output);
    const {size} = await fs.promises.stat(options.output);
    return {bytes: size, output: options.output};
  }

  if (format === 'geojson' && isWgs84(crs)) {
    if (path.resolve(options.inputGeoJson) !== path.resolve(options.output)) {
      await fs.promises.copyFile(options.inputGeoJson, options.output);
    }
    const {size} = await fs.promises.stat(options.output);
    return {bytes: size, output: options.output};
  }

  const flatPath = tempPath('-flat.geojson');
  try {
    const count = await writeFlatGeoJson(options.inputGeoJson, flatPath);
    if (count === 0) {
      throw new Error('No leaf Features found to convert');
    }
    log(`flattened ${count} features for ${format} ${crs} (${info.nesting})`);

    if (format === 'geojson') {
      await reprojectFlatGeoJson(flatPath, options.output, crs);
    } else if (format === 'gpkg') {
      await writeGpkg(flatPath, options.output, crs);
    } else if (format === 'gdb') {
      await writeGdbZip(flatPath, options.output, crs, options.name);
    } else {
      await writeShapefileZip(flatPath, options.output, crs);
    }
  } finally {
    await fs.promises.rm(flatPath, {force: true});
  }

  const {size} = await fs.promises.stat(options.output);
  return {bytes: size, output: options.output};
};
