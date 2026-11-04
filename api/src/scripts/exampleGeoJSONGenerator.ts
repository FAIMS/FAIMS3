// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Stream a large example GeoJSON file for map-layer / GDAL / tippecanoe tests.
 *
 * Writes incrementally so a 500MB file does not need to fit in RAM. Nested
 * mode emits a FeatureCollection of FeatureCollections (non-RFC but useful for
 * stressing parsers). Flat mode is a single RFC 7946 FeatureCollection.
 *
 * Usage (from api/):
 *   pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --help
 *   pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --size 500MB \
 *     --structure nested --geometry mixed --attribute-mode mixed \
 *     --out /tmp/example.geojson
 *
 *   pnpm run generate-example-geojson -- --size 5MB --geometry point --out ./dots.geojson
 *   pnpm run generate-example-geojson -- --format kml --structure nested --out ./nested.kml
 *   pnpm run generate-example-geojson -- --format gdb --crs EPSG:28355 --out ./polys.gdb.zip
 */
import {randomUUID} from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {convertGeneratedSpatial} from './spatialFormatConvert';
import {
  SPATIAL_FORMAT_INFO,
  WGS84,
  defaultOutputPath,
  isWgs84,
  parseCrs,
  parseSpatialFormat,
  type SpatialFormat,
} from './spatialTestFormats';

type Structure = 'flat' | 'nested';
type AttributeMode = 'consistent' | 'mixed';
type GeometryKind = 'point' | 'line' | 'polygon';
type GeometryChoice = GeometryKind | 'mixed';

type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type CliArgs = {
  help: boolean;
  dryRun: boolean;
  quiet: boolean;
  output: string;
  sizeBytes: number | undefined;
  featureCount: number | undefined;
  structure: Structure;
  geometry: GeometryChoice;
  attributes: number;
  attributeMode: AttributeMode;
  nestingDepth: number;
  featuresPerCollection: number;
  vertices: number;
  seed: number;
  bbox: BBox;
  pretty: boolean;
  includeBbox: boolean;
  groupByGeometry: boolean;
  multi: boolean;
  geometryCollections: boolean;
  withZ: boolean;
  clusterSize: number;
  clusterRadius: number;
  name: string;
  format: SpatialFormat;
  crs: string;
};

type Position = [number, number] | [number, number, number];

type Geometry =
  | {type: 'Point'; coordinates: Position}
  | {type: 'MultiPoint'; coordinates: Position[]}
  | {type: 'LineString'; coordinates: Position[]}
  | {type: 'MultiLineString'; coordinates: Position[][]}
  | {type: 'Polygon'; coordinates: Position[][]}
  | {type: 'MultiPolygon'; coordinates: Position[][][]}
  | {type: 'GeometryCollection'; geometries: Geometry[]};

type Feature = {
  type: 'Feature';
  id?: string;
  bbox?: [number, number, number, number];
  geometry: Geometry;
  properties: Record<string, unknown>;
};

const DEFAULT_BBOX: BBox = {
  west: 112.911,
  south: -43.643,
  east: 153.639,
  north: -10.668,
};

const GEOMETRY_KINDS: GeometryKind[] = ['point', 'line', 'polygon'];

const CATEGORIES = [
  'site',
  'transect',
  'boundary',
  'sample',
  'track',
  'area',
  'marker',
] as const;

const CONSISTENT_ATTR_KEYS = [
  'name',
  'category',
  'value',
  'active',
  'timestamp',
  'source',
  'quality',
  'notes',
  'priority',
  'region',
] as const;

const EXTRA_ATTR_KEYS = [
  'operator',
  'device',
  'survey_id',
  'habitat',
  'confidence',
  'legacy_code',
  'tags',
] as const;

/** Default output size when neither --size nor --count is given. */
const DEFAULT_SIZE_BYTES = 1024 * 1024;

const showHelp = (): void => {
  console.log(`Usage: pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts [options]

Stream a synthetic GeoJSON FeatureCollection for spatial-pipeline tests.

Structure:
  --structure nested|flat     Nested FeatureCollections, or one flat collection
                              (default: nested)
  --nesting-depth <n>         Collection tree depth including the root (default: 2)
  --features-per-collection <n>
                              Max children in each nested collection (default: 64)
  --group-by-geometry         Nested children are single-geometry collections

Geometry:
  --geometry mixed|point|line|polygon
                              One kind, or a mix of polygons / lines / dots
                              (default: mixed). Aliases: dot(s), linestring(s)
  --vertices <n>              Vertices per line/polygon ring (default: 8)
  --multi                     Also emit MultiPoint / MultiLineString / MultiPolygon
  --geometry-collections      Occasionally wrap mixed geometries in a
                              GeometryCollection
  --z                         Add a Z coordinate to every position

Size / count (stop at whichever limit is hit first):
  --size <bytes>              Target file size, e.g. 500MB, 12m, 250kb, 1000000
                              (default: 1MB when --count is omitted)
  --count <n>                 Maximum Feature objects to emit

Attributes:
  --attributes <n>            Property keys per feature (default: 6)
  --attribute-mode consistent|mixed
                              Same schema on every feature, or varying keys/types
                              (default: consistent)

Format / CRS:
  --format geojson|kml|gpkg|shapefile|gdb
                              Output format (default: geojson). Shapefile and
                              FileGDB are zipped for upload (.zip / .gdb.zip).
  --crs EPSG:4326             Reproject after generation. KML is WGS84-only
                              and ignores other CRS values. GeoJSON stays
                              nested only in WGS84; other CRS flatten.

Output:
  -o, --out <path>            Destination file (default: ./example.<ext>)
  --name <string>             Root collection name (default: example-geojson)
  --pretty                    Indent JSON (avoid for large files)
  --include-bbox              Write a bbox on each Feature
  --quiet                     Progress to stderr only on completion
  --dry-run                   Print resolved options; do not write a file

Generation:
  --seed <n>                  PRNG seed (default: 1)
  --bbox west,south,east,north
                              WGS84 bounds (default: mainland Australia)
  --cluster-size <n>          Features sharing a local centre (default: 80)
  --cluster-radius <deg>      Cluster spread in degrees (default: 0.08)

  -h, --help                  Show this help

Examples:
  # Complex ~500MB nested mix for parser / GDAL stress tests
  pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --size 500MB \\
    --structure nested --geometry mixed --attribute-mode mixed \\
    --attributes 12 --multi --geometry-collections --out /tmp/big.geojson

  # Flat point layer, fixed schema
  pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --structure flat \\
    --geometry point --size 10MB --attribute-mode consistent --out ./dots.geojson

  # Nested KML folders
  pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --format kml \\
    --structure nested --geometry mixed --out ./nested.kml

  # FileGDB in GDA94 / MGA zone 55
  pnpm exec tsx src/scripts/exampleGeoJSONGenerator.ts --format gdb \\
    --crs EPSG:28355 --structure flat --geometry polygon --out ./polys.gdb.zip
`);
};

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

export const parseByteSize = (raw: string): number => {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|k|mb|m|gb|g)?$/i);
  if (!match) {
    throw new Error(
      `Invalid --size value '${raw}'. Use e.g. 500MB, 12m, 250kb, or a byte count.`
    );
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  const multipliers: Record<string, number> = {
    b: 1,
    k: 1024,
    kb: 1024,
    m: 1024 * 1024,
    mb: 1024 * 1024,
    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  const bytes = Math.round(amount * multipliers[unit]);
  if (!Number.isInteger(bytes) || bytes < 1) {
    throw new Error(`--size must be at least 1 byte (got ${raw})`);
  }
  return bytes;
};

const parsePositiveInt = (raw: string | undefined, flag: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid ${flag} value: ${raw}`);
  }
  return n;
};

const parseNonNegInt = (raw: string | undefined, flag: string): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid ${flag} value: ${raw}`);
  }
  return n;
};

const parsePositiveNumber = (raw: string | undefined, flag: string): number => {
  const n = Number(raw);
  if (!isFiniteNumber(n) || n <= 0) {
    throw new Error(`Invalid ${flag} value: ${raw}`);
  }
  return n;
};

const parseGeometry = (raw: string): GeometryChoice => {
  const value = raw.trim().toLowerCase();
  if (value === 'mixed' || value === 'mix') {
    return 'mixed';
  }
  if (value === 'point' || value === 'dot' || value === 'dots') {
    return 'point';
  }
  if (value === 'line' || value === 'lines' || value === 'linestring') {
    return 'line';
  }
  if (value === 'polygon' || value === 'polygons' || value === 'poly') {
    return 'polygon';
  }
  throw new Error(
    `Invalid --geometry '${raw}'. Use mixed, point, line, or polygon.`
  );
};

const parseStructure = (raw: string): Structure => {
  const value = raw.trim().toLowerCase();
  if (value === 'nested' || value === 'nest') {
    return 'nested';
  }
  if (value === 'flat' || value === 'flattened' || value === 'flatten') {
    return 'flat';
  }
  throw new Error(`Invalid --structure '${raw}'. Use nested or flat.`);
};

const parseAttributeMode = (raw: string): AttributeMode => {
  const value = raw.trim().toLowerCase();
  if (value === 'consistent' || value === 'same' || value === 'fixed') {
    return 'consistent';
  }
  if (value === 'mixed' || value === 'mix' || value === 'varied') {
    return 'mixed';
  }
  throw new Error(
    `Invalid --attribute-mode '${raw}'. Use consistent or mixed.`
  );
};

const parseBBox = (raw: string): BBox => {
  const parts = raw.split(',').map(part => Number(part.trim()));
  if (parts.length !== 4 || parts.some(part => !isFiniteNumber(part))) {
    throw new Error(
      `Invalid --bbox '${raw}'. Expected west,south,east,north numbers.`
    );
  }
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) {
    throw new Error('--bbox requires west < east and south < north');
  }
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    throw new Error(
      '--bbox must stay within WGS84 lon [-180,180] lat [-90,90]'
    );
  }
  return {west, south, east, north};
};

const takeValue = (
  argv: string[],
  i: number,
  flag: string
): {value: string; next: number} => {
  const current = argv[i];
  const eq = current.indexOf('=');
  if (eq >= 0 && current.startsWith(flag)) {
    return {value: current.slice(eq + 1), next: i};
  }
  const raw = argv[i + 1];
  if (raw === undefined || raw.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return {value: raw, next: i + 1};
};

export const defaultCliArgs = (): CliArgs => ({
  help: false,
  dryRun: false,
  quiet: false,
  output: path.resolve('example.geojson'),
  sizeBytes: undefined,
  featureCount: undefined,
  structure: 'nested',
  geometry: 'mixed',
  attributes: 6,
  attributeMode: 'consistent',
  nestingDepth: 2,
  featuresPerCollection: 64,
  vertices: 8,
  seed: 1,
  bbox: {...DEFAULT_BBOX},
  pretty: false,
  includeBbox: false,
  groupByGeometry: false,
  multi: false,
  geometryCollections: false,
  withZ: false,
  clusterSize: 80,
  clusterRadius: 0.08,
  name: 'example-geojson',
  format: 'geojson',
  crs: WGS84,
});

const parseArgs = (argv: string[]): CliArgs => {
  const args = defaultCliArgs();
  let outputSet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--quiet') {
      args.quiet = true;
      continue;
    }
    if (arg === '--pretty') {
      args.pretty = true;
      continue;
    }
    if (arg === '--include-bbox') {
      args.includeBbox = true;
      continue;
    }
    if (arg === '--group-by-geometry') {
      args.groupByGeometry = true;
      continue;
    }
    if (arg === '--multi') {
      args.multi = true;
      continue;
    }
    if (arg === '--geometry-collections') {
      args.geometryCollections = true;
      continue;
    }
    if (arg === '--z' || arg === '--3d') {
      args.withZ = true;
      continue;
    }
    if (arg === '-o' || arg === '--out' || arg.startsWith('--out=')) {
      const taken = takeValue(argv, i, '--out');
      args.output = path.resolve(taken.value);
      outputSet = true;
      i = taken.next;
      continue;
    }
    if (arg === '--size' || arg.startsWith('--size=')) {
      const taken = takeValue(argv, i, '--size');
      args.sizeBytes = parseByteSize(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--count' || arg.startsWith('--count=')) {
      const taken = takeValue(argv, i, '--count');
      args.featureCount = parsePositiveInt(taken.value, '--count');
      i = taken.next;
      continue;
    }
    if (arg === '--structure' || arg.startsWith('--structure=')) {
      const taken = takeValue(argv, i, '--structure');
      args.structure = parseStructure(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--geometry' || arg.startsWith('--geometry=')) {
      const taken = takeValue(argv, i, '--geometry');
      args.geometry = parseGeometry(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--attributes' || arg.startsWith('--attributes=')) {
      const taken = takeValue(argv, i, '--attributes');
      args.attributes = parseNonNegInt(taken.value, '--attributes');
      i = taken.next;
      continue;
    }
    if (arg === '--attribute-mode' || arg.startsWith('--attribute-mode=')) {
      const taken = takeValue(argv, i, '--attribute-mode');
      args.attributeMode = parseAttributeMode(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--nesting-depth' || arg.startsWith('--nesting-depth=')) {
      const taken = takeValue(argv, i, '--nesting-depth');
      args.nestingDepth = parsePositiveInt(taken.value, '--nesting-depth');
      i = taken.next;
      continue;
    }
    if (
      arg === '--features-per-collection' ||
      arg.startsWith('--features-per-collection=')
    ) {
      const taken = takeValue(argv, i, '--features-per-collection');
      args.featuresPerCollection = parsePositiveInt(
        taken.value,
        '--features-per-collection'
      );
      i = taken.next;
      continue;
    }
    if (arg === '--vertices' || arg.startsWith('--vertices=')) {
      const taken = takeValue(argv, i, '--vertices');
      args.vertices = parsePositiveInt(taken.value, '--vertices');
      if (args.vertices < 2) {
        throw new Error('--vertices must be at least 2');
      }
      i = taken.next;
      continue;
    }
    if (arg === '--seed' || arg.startsWith('--seed=')) {
      const taken = takeValue(argv, i, '--seed');
      const n = Number(taken.value);
      if (!Number.isInteger(n)) {
        throw new Error(`Invalid --seed value: ${taken.value}`);
      }
      args.seed = n;
      i = taken.next;
      continue;
    }
    if (arg === '--bbox' || arg.startsWith('--bbox=')) {
      const taken = takeValue(argv, i, '--bbox');
      args.bbox = parseBBox(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--cluster-size' || arg.startsWith('--cluster-size=')) {
      const taken = takeValue(argv, i, '--cluster-size');
      args.clusterSize = parsePositiveInt(taken.value, '--cluster-size');
      i = taken.next;
      continue;
    }
    if (arg === '--cluster-radius' || arg.startsWith('--cluster-radius=')) {
      const taken = takeValue(argv, i, '--cluster-radius');
      args.clusterRadius = parsePositiveNumber(taken.value, '--cluster-radius');
      i = taken.next;
      continue;
    }
    if (arg === '--name' || arg.startsWith('--name=')) {
      const taken = takeValue(argv, i, '--name');
      if (!taken.value.trim()) {
        throw new Error('--name must not be empty');
      }
      args.name = taken.value;
      i = taken.next;
      continue;
    }
    if (arg === '--format' || arg.startsWith('--format=')) {
      const taken = takeValue(argv, i, '--format');
      args.format = parseSpatialFormat(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--crs' || arg.startsWith('--crs=')) {
      const taken = takeValue(argv, i, '--crs');
      args.crs = parseCrs(taken.value);
      i = taken.next;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (args.structure === 'flat') {
    args.nestingDepth = 1;
  }
  if (!outputSet) {
    args.output = path.resolve(defaultOutputPath(args.format));
  }

  return args;
};

/** Mulberry32 — small, deterministic, good enough for synthetic GIS data. */
const createRng = (seed: number): (() => number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

class ByteWriter {
  bytes = 0;
  private readonly stream: fs.WriteStream;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    this.stream = fs.createWriteStream(filePath, {
      encoding: 'utf8',
      highWaterMark: 1024 * 1024,
    });
  }

  async write(chunk: string): Promise<void> {
    this.bytes += Buffer.byteLength(chunk, 'utf8');
    if (this.stream.write(chunk)) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.stream.off('drain', onDrain);
        reject(err);
      };
      const onDrain = () => {
        this.stream.off('error', onError);
        resolve();
      };
      this.stream.once('error', onError);
      this.stream.once('drain', onDrain);
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end(() => resolve());
      this.stream.once('error', reject);
    });
  }
}

class Generator {
  private readonly rng: () => number;
  private readonly writer: ByteWriter;
  private readonly indent: string | undefined;
  private featureIndex = 0;
  private collectionIndex = 0;
  private clusterCenter: {lon: number; lat: number};
  private readonly startedAt = Date.now();
  private lastProgressAt = Date.now();
  private lastProgressBytes = 0;

  constructor(
    private readonly args: CliArgs,
    writer: ByteWriter
  ) {
    this.rng = createRng(args.seed);
    this.writer = writer;
    this.indent = args.pretty ? '  ' : undefined;
    this.clusterCenter = this.randomPointInBbox();
  }

  get featureCount(): number {
    return this.featureIndex;
  }

  get bytes(): number {
    return this.writer.bytes;
  }

  async generate(): Promise<void> {
    await this.writeCollection({
      name: this.args.name,
      depthRemaining:
        this.args.structure === 'nested' ? this.args.nestingDepth : 1,
      unbounded: true,
      forcedGeometry:
        this.args.geometry === 'mixed' ? undefined : this.args.geometry,
    });
  }

  private shouldContinue(): boolean {
    if (
      this.args.featureCount !== undefined &&
      this.featureIndex >= this.args.featureCount
    ) {
      return false;
    }
    const target = this.args.sizeBytes ?? DEFAULT_SIZE_BYTES;
    // Leave a small tail for closing brackets so we land near the request.
    return this.writer.bytes + 32 < target;
  }

  private async writeCollection(options: {
    name: string;
    depthRemaining: number;
    unbounded: boolean;
    forcedGeometry?: GeometryKind;
  }): Promise<void> {
    const collectionId = this.collectionIndex++;
    const header: Record<string, unknown> = {
      type: 'FeatureCollection',
      name: options.name,
      generator: 'exampleGeoJSONGenerator',
      collectionId,
    };
    if (options.forcedGeometry) {
      header.geometryKind = options.forcedGeometry;
    }
    await this.writer.write(this.openObject(header));
    await this.writer.write(this.arrayOpen('features'));

    let first = true;
    let emitted = 0;
    const limit = options.unbounded
      ? Number.POSITIVE_INFINITY
      : this.args.featuresPerCollection;
    const nestChildren = options.depthRemaining > 1;

    while (this.shouldContinue() && emitted < limit) {
      if (!first) {
        await this.writer.write(',');
      }
      first = false;

      if (nestChildren) {
        const childGeometry = this.childGeometry(
          options.forcedGeometry,
          emitted
        );
        await this.writeCollection({
          name: `${options.name}/${childGeometry ?? 'mixed'}-${emitted}`,
          depthRemaining: options.depthRemaining - 1,
          unbounded: false,
          forcedGeometry: childGeometry,
        });
      } else {
        await this.writeFeature(options.forcedGeometry);
      }
      emitted += 1;
    }

    await this.writer.write(this.arrayClose());
    await this.writer.write('}');
  }

  private childGeometry(
    parentForced: GeometryKind | undefined,
    index: number
  ): GeometryKind | undefined {
    if (parentForced) {
      return parentForced;
    }
    if (this.args.geometry !== 'mixed') {
      return this.args.geometry;
    }
    if (this.args.groupByGeometry) {
      return GEOMETRY_KINDS[index % GEOMETRY_KINDS.length];
    }
    return undefined;
  }

  private async writeFeature(forcedGeometry?: GeometryKind): Promise<void> {
    this.refreshCluster();
    const feature = this.buildFeature(forcedGeometry);
    const json = this.indent
      ? JSON.stringify(feature, null, 2)
      : JSON.stringify(feature);
    await this.writer.write(json);
    this.maybeLogProgress();
  }

  private buildFeature(forcedGeometry?: GeometryKind): Feature {
    const id = `feat-${String(this.featureIndex).padStart(8, '0')}`;
    this.featureIndex += 1;
    const geometry = this.buildGeometry(forcedGeometry);
    const feature: Feature = {
      type: 'Feature',
      id,
      geometry,
      properties: this.buildProperties(id, geometry.type),
    };
    if (this.args.includeBbox) {
      const bbox = bboxOfGeometry(geometry);
      if (bbox) {
        feature.bbox = bbox;
      }
    }
    return feature;
  }

  private buildGeometry(forcedGeometry?: GeometryKind): Geometry {
    if (
      this.args.geometryCollections &&
      this.args.geometry === 'mixed' &&
      !forcedGeometry &&
      this.rng() < 0.12
    ) {
      const count = 2 + Math.floor(this.rng() * 3);
      const geometries: Geometry[] = [];
      for (let i = 0; i < count; i++) {
        geometries.push(this.buildSimpleGeometry(this.pickKind(undefined)));
      }
      return {type: 'GeometryCollection', geometries};
    }
    return this.buildSimpleGeometry(this.pickKind(forcedGeometry));
  }

  private pickKind(forcedGeometry?: GeometryKind): GeometryKind {
    if (forcedGeometry) {
      return forcedGeometry;
    }
    if (this.args.geometry !== 'mixed') {
      return this.args.geometry;
    }
    return GEOMETRY_KINDS[Math.floor(this.rng() * GEOMETRY_KINDS.length)];
  }

  private buildSimpleGeometry(kind: GeometryKind): Geometry {
    const useMulti = this.args.multi && this.rng() < 0.25;
    if (kind === 'point') {
      if (useMulti) {
        const count = 2 + Math.floor(this.rng() * 4);
        return {
          type: 'MultiPoint',
          coordinates: Array.from({length: count}, () => this.nearbyPosition()),
        };
      }
      return {type: 'Point', coordinates: this.nearbyPosition()};
    }
    if (kind === 'line') {
      if (useMulti) {
        const parts = 2 + Math.floor(this.rng() * 2);
        return {
          type: 'MultiLineString',
          coordinates: Array.from({length: parts}, () => this.lineCoords()),
        };
      }
      return {type: 'LineString', coordinates: this.lineCoords()};
    }
    if (useMulti) {
      const parts = 2 + Math.floor(this.rng() * 2);
      return {
        type: 'MultiPolygon',
        coordinates: Array.from({length: parts}, () => [this.ringCoords()]),
      };
    }
    return {type: 'Polygon', coordinates: [this.ringCoords()]};
  }

  private buildProperties(
    id: string,
    geometryType: string
  ): Record<string, unknown> {
    const count = this.args.attributes;
    if (count === 0) {
      return {};
    }
    const keys = this.attributeKeys(count);
    const properties: Record<string, unknown> = {};
    if (this.args.attributeMode === 'consistent') {
      for (const key of keys) {
        properties[key] = this.consistentValue(key, id, geometryType);
      }
      return properties;
    }

    // Mixed: keep a random subset, vary types, and sprinkle extra keys.
    const keep = keys.filter(() => this.rng() > 0.25);
    if (keep.length === 0 && keys[0]) {
      keep.push(keys[0]);
    }
    for (const key of keep) {
      properties[key] =
        this.rng() < 0.08 ? null : this.mixedValue(key, id, geometryType);
    }
    const extraCount = Math.floor(this.rng() * Math.min(4, count));
    for (let i = 0; i < extraCount; i++) {
      const extra =
        EXTRA_ATTR_KEYS[Math.floor(this.rng() * EXTRA_ATTR_KEYS.length)];
      properties[`${extra}_${i}`] = this.mixedValue(extra, id, geometryType);
    }
    if (this.rng() < 0.1) {
      properties.meta = {
        nested: true,
        rank: Math.floor(this.rng() * 10),
      };
    }
    if (this.rng() < 0.08) {
      properties.tags = CATEGORIES.slice(0, 1 + Math.floor(this.rng() * 3));
    }
    return properties;
  }

  private attributeKeys(count: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      keys.push(CONSISTENT_ATTR_KEYS[i] ?? `attr_${i}`);
    }
    return keys;
  }

  private consistentValue(
    key: string,
    id: string,
    geometryType: string
  ): unknown {
    switch (key) {
      case 'name':
        return `${geometryType.toLowerCase()}-${id}`;
      case 'category':
        return CATEGORIES[this.featureIndex % CATEGORIES.length];
      case 'value':
        return round6(this.rng() * 1000);
      case 'active':
        return this.featureIndex % 3 !== 0;
      case 'timestamp':
        return new Date(
          1_700_000_000_000 + this.featureIndex * 1000
        ).toISOString();
      case 'source':
        return 'exampleGeoJSONGenerator';
      case 'quality':
        return (this.featureIndex % 5) + 1;
      case 'notes':
        return `Synthetic ${geometryType} feature ${id}`;
      case 'priority':
        return this.featureIndex % 10;
      case 'region':
        return `cluster-${Math.floor(this.featureIndex / this.args.clusterSize)}`;
      default:
        return `${key}-${this.featureIndex}`;
    }
  }

  private mixedValue(key: string, id: string, geometryType: string): unknown {
    const roll = this.rng();
    if (roll < 0.2) {
      return Math.floor(this.rng() * 10_000);
    }
    if (roll < 0.35) {
      return round6(this.rng() * 100);
    }
    if (roll < 0.45) {
      return this.rng() > 0.5;
    }
    if (roll < 0.55) {
      return new Date(
        1_700_000_000_000 + this.featureIndex * 137
      ).toISOString();
    }
    return this.consistentValue(key, id, geometryType);
  }

  private refreshCluster(): void {
    if (this.featureIndex % this.args.clusterSize === 0) {
      this.clusterCenter = this.randomPointInBbox();
    }
  }

  private randomPointInBbox(): {lon: number; lat: number} {
    const {west, south, east, north} = this.args.bbox;
    return {
      lon: west + this.rng() * (east - west),
      lat: south + this.rng() * (north - south),
    };
  }

  private nearbyPosition(): Position {
    const {west, south, east, north} = this.args.bbox;
    const radius = this.args.clusterRadius;
    const lon = clamp(
      this.clusterCenter.lon + (this.rng() * 2 - 1) * radius,
      west,
      east
    );
    const lat = clamp(
      this.clusterCenter.lat + (this.rng() * 2 - 1) * radius,
      south,
      north
    );
    if (this.args.withZ) {
      return [round6(lon), round6(lat), round6(this.rng() * 800)];
    }
    return [round6(lon), round6(lat)];
  }

  private lineCoords(): Position[] {
    const count = Math.max(2, this.args.vertices);
    const coords: Position[] = [];
    for (let i = 0; i < count; i++) {
      coords.push(this.nearbyPosition());
    }
    return coords;
  }

  private ringCoords(): Position[] {
    const count = Math.max(3, this.args.vertices);
    const {west, south, east, north} = this.args.bbox;
    const radius = Math.max(
      0.0005,
      this.args.clusterRadius * (0.15 + this.rng() * 0.35)
    );
    const coords: Position[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      const lon = clamp(
        this.clusterCenter.lon + Math.cos(angle) * radius,
        west,
        east
      );
      const lat = clamp(
        this.clusterCenter.lat + Math.sin(angle) * radius,
        south,
        north
      );
      if (this.args.withZ) {
        coords.push([round6(lon), round6(lat), round6(this.rng() * 800)]);
      } else {
        coords.push([round6(lon), round6(lat)]);
      }
    }
    coords.push(coords[0]);
    return coords;
  }

  private openObject(fields: Record<string, unknown>): string {
    const parts = Object.entries(fields).map(
      ([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`
    );
    return `{${parts.join(',')},`;
  }

  private arrayOpen(key: string): string {
    return `${JSON.stringify(key)}:[`;
  }

  private arrayClose(): string {
    return ']';
  }

  private maybeLogProgress(): void {
    if (this.args.quiet) {
      return;
    }
    const now = Date.now();
    if (now - this.lastProgressAt < 2000 && this.featureIndex % 2500 !== 0) {
      return;
    }
    const elapsedSec = Math.max(0.001, (now - this.startedAt) / 1000);
    const mbPerSec = this.writer.bytes / (1024 * 1024) / elapsedSec;
    const deltaBytes = this.writer.bytes - this.lastProgressBytes;
    const target = this.args.sizeBytes ?? DEFAULT_SIZE_BYTES;
    const pct = Math.min(100, (this.writer.bytes / target) * 100);
    process.stderr.write(
      `[example-geojson] ${pct.toFixed(1)}%  ${formatBytes(this.writer.bytes)}  ` +
        `${this.featureIndex} features  ${mbPerSec.toFixed(1)} MB/s  ` +
        `+${formatBytes(deltaBytes)}\n`
    );
    this.lastProgressAt = now;
    this.lastProgressBytes = this.writer.bytes;
  }
}

const walkPositions = (
  geometry: Geometry,
  visit: (position: Position) => void
): void => {
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates);
      return;
    case 'MultiPoint':
    case 'LineString':
      for (const position of geometry.coordinates) {
        visit(position);
      }
      return;
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of geometry.coordinates) {
        for (const position of ring) {
          visit(position);
        }
      }
      return;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const position of ring) {
            visit(position);
          }
        }
      }
      return;
    case 'GeometryCollection':
      for (const child of geometry.geometries) {
        walkPositions(child, visit);
      }
  }
};

const bboxOfGeometry = (
  geometry: Geometry
): [number, number, number, number] | undefined => {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  walkPositions(geometry, position => {
    west = Math.min(west, position[0]);
    east = Math.max(east, position[0]);
    south = Math.min(south, position[1]);
    north = Math.max(north, position[1]);
  });
  if (!isFiniteNumber(west)) {
    return undefined;
  }
  return [round6(west), round6(south), round6(east), round6(north)];
};

const describePlan = (args: CliArgs): Record<string, unknown> => {
  const sizeBytes =
    args.sizeBytes ??
    (args.featureCount === undefined ? DEFAULT_SIZE_BYTES : undefined);
  return {
    output: args.output,
    size: sizeBytes === undefined ? undefined : formatBytes(sizeBytes),
    sizeBytes,
    featureCount: args.featureCount,
    structure: args.structure,
    geometry: args.geometry,
    attributes: args.attributes,
    attributeMode: args.attributeMode,
    nestingDepth: args.nestingDepth,
    featuresPerCollection: args.featuresPerCollection,
    vertices: args.vertices,
    seed: args.seed,
    bbox: args.bbox,
    pretty: args.pretty,
    includeBbox: args.includeBbox,
    groupByGeometry: args.groupByGeometry,
    multi: args.multi,
    geometryCollections: args.geometryCollections,
    withZ: args.withZ,
    clusterSize: args.clusterSize,
    clusterRadius: args.clusterRadius,
    name: args.name,
    format: args.format,
    crs: args.crs,
    nesting: SPATIAL_FORMAT_INFO[args.format].nesting,
  };
};

const writeGeneratedGeoJson = async (
  args: CliArgs,
  output: string
): Promise<{bytes: number; features: number; output: string}> => {
  const writer = new ByteWriter(output);
  const generator = new Generator(args, writer);
  try {
    await generator.generate();
    await writer.close();
  } catch (err) {
    await writer.close().catch(() => undefined);
    throw err;
  }
  return {
    bytes: generator.bytes,
    features: generator.featureCount,
    output,
  };
};

/**
 * Generate WGS84 GeoJSON, then convert to `--format` / `--crs` when needed.
 */
export const generateExampleGeoJSON = async (
  args: CliArgs
): Promise<{
  bytes: number;
  features: number;
  output: string;
}> => {
  const format = args.format ?? 'geojson';
  const crs = args.crs ?? WGS84;
  const needsConvert = format !== 'geojson' || !isWgs84(crs);
  const geojsonPath = needsConvert
    ? path.join(os.tmpdir(), `faims-gen-${randomUUID()}.geojson`)
    : args.output;

  const generated = await writeGeneratedGeoJson(args, geojsonPath);
  if (!needsConvert) {
    return generated;
  }

  try {
    const converted = await convertGeneratedSpatial({
      inputGeoJson: geojsonPath,
      output: args.output,
      format,
      crs,
      name: args.name,
    });
    return {
      bytes: converted.bytes,
      features: generated.features,
      output: converted.output,
    };
  } finally {
    await fs.promises.rm(geojsonPath, {force: true});
  }
};

const main = async (): Promise<void> => {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    showHelp();
    process.exit(1);
  }

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.sizeBytes === undefined && args.featureCount === undefined) {
    args.sizeBytes = DEFAULT_SIZE_BYTES;
  }

  const plan = describePlan(args);
  if (args.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  }

  if (!args.quiet) {
    process.stderr.write(
      `[example-geojson] writing ${plan.structure} ${plan.geometry} ${args.format} ` +
        `${args.crs} (target ${plan.size ?? `${plan.featureCount} features`}) -> ${args.output}\n`
    );
  }

  const startedAt = Date.now();
  const result = await generateExampleGeoJSON(args);
  const elapsedMs = Date.now() - startedAt;
  process.stderr.write(
    `[example-geojson] wrote ${formatBytes(result.bytes)} ` +
      `(${result.features} features) to ${result.output} in ${(elapsedMs / 1000).toFixed(1)}s\n`
  );
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  /^exampleGeoJSONGenerator(\.[cm]?js|\.ts)?$/.test(
    path.basename(process.argv[1])
  );

if (invokedDirectly) {
  main().catch(err => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exit(1);
  });
}
