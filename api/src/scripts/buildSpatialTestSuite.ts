// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Build a zip of profiled vector files plus Sentinel-2 raster fixtures
 * (GeoTIFF, JPEG+world, PNG+world, georeferenced PDF) in several CRSes.
 *
 * Usage (from api/):
 *   pnpm run build-spatial-test-suite -- --size 10MB
 *   pnpm run build-spatial-test-suite -- --formats kml,gpkg --crs EPSG:4326,EPSG:3857
 *   pnpm run build-spatial-test-suite -- --only flat-points,gdb
 *   pnpm run build-spatial-test-suite -- --rasters-only --raster-size 50MB
 */
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import {finished} from 'stream/promises';
import {
  type CliArgs,
  defaultCliArgs,
  formatBytes,
  generateExampleGeoJSON,
  parseByteSize,
} from './exampleGeoJSONGenerator';
import {
  applySizesToCases,
  buildSuiteTestCases,
  parseOnlyTokens,
  parseSuiteFormats,
  type ParsedSuiteFormats,
  type SpatialTestCase,
} from './spatialTestProfiles';
import {
  RASTER_DEFAULT_CRS,
  RASTER_FORMATS,
  type RasterFormat,
} from './spatialRasterFormats';
import {writeRasterTestCase} from './spatialRasterConvert';
import {DEFAULT_RASTER_SIZE_BYTES} from './spatialRasterSource';
import {
  SPATIAL_FORMATS,
  WGS84,
  parseCrsList,
  type SpatialFormat,
} from './spatialTestFormats';

type SuiteArgs = {
  help: boolean;
  list: boolean;
  dryRun: boolean;
  clean: boolean;
  skipExisting: boolean;
  sizeBytes: number;
  rasterSizeBytes: number;
  includeVectors: boolean;
  includeRasters: boolean;
  output: string;
  stageDir: string | undefined;
  rasterCacheDir: string;
  vectorFormats: SpatialFormat[] | undefined;
  rasterFormats: RasterFormat[] | undefined;
  vectorCrsList: string[] | undefined;
  rasterCrsList: string[] | undefined;
  only: string[] | undefined;
};

const DEFAULT_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ZIP = path.resolve('../tmp/spatial-test-suite.zip');
const DEFAULT_RASTER_CACHE = path.resolve('../tmp/spatial-raster-cache');

const showHelp = (): void => {
  console.log(`Usage: pnpm run build-spatial-test-suite [options]

Generate a cross-format map-layer fixture suite and zip it.

Vector cases are generated. Raster cases download a pinned Sentinel-2 L2A
RGB window (Earth Search, no auth) and write GeoTIFF / JPEG / PNG / PDF.

Options:
  --size <bytes>        Target GeoJSON size per vector case (default: 10MB)
  --raster-size <bytes> Target uncompressed RGB size per raster (default: 50MB)
  --formats a,b         geojson,kml,gpkg,shapefile,gdb,geotiff,jpeg,png,pdf
  --crs EPSG:4326,...   CRS for both kinds when set. Vector default EPSG:4326;
                        raster default EPSG:4326,3857,28356. KML stays WGS84.
  --no-rasters          Skip satellite raster cases
  --rasters-only        Only satellite raster cases
  -o, --out <path>      Zip path (default: ../tmp/spatial-test-suite.zip)
  --dir <path>          Staging directory
  --raster-cache <path> Shared native-window cache
  --only token,token    Format, geometry profile id, raster, or case id
  --skip-existing       Reuse a staging file near the target size
  --clean               Delete staging after a successful zip
  --list                Print planned cases and exit
  --dry-run             Print the plan; do not write files
  -h, --help            Show this help
`);
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

const parseArgs = (argv: string[]): SuiteArgs => {
  const args: SuiteArgs = {
    help: false,
    list: false,
    dryRun: false,
    clean: false,
    skipExisting: false,
    sizeBytes: DEFAULT_SIZE_BYTES,
    rasterSizeBytes: DEFAULT_RASTER_SIZE_BYTES,
    includeVectors: true,
    includeRasters: true,
    output: DEFAULT_ZIP,
    stageDir: undefined,
    rasterCacheDir: DEFAULT_RASTER_CACHE,
    vectorFormats: undefined,
    rasterFormats: undefined,
    vectorCrsList: undefined,
    rasterCrsList: undefined,
    only: undefined,
  };
  let formats: ParsedSuiteFormats | undefined;
  let crsList: string[] | undefined;
  let noRasters = false;
  let rastersOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--' || arg === '') {
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
    if (arg === '--list') {
      args.list = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--clean') {
      args.clean = true;
      continue;
    }
    if (arg === '--skip-existing') {
      args.skipExisting = true;
      continue;
    }
    if (arg === '--size' || arg.startsWith('--size=')) {
      const taken = takeValue(argv, i, '--size');
      args.sizeBytes = parseByteSize(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--formats' || arg.startsWith('--formats=')) {
      const taken = takeValue(argv, i, '--formats');
      formats = parseSuiteFormats(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--crs' || arg.startsWith('--crs=')) {
      const taken = takeValue(argv, i, '--crs');
      crsList = parseCrsList(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--raster-size' || arg.startsWith('--raster-size=')) {
      const taken = takeValue(argv, i, '--raster-size');
      args.rasterSizeBytes = parseByteSize(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--no-rasters') {
      noRasters = true;
      continue;
    }
    if (arg === '--rasters-only') {
      rastersOnly = true;
      continue;
    }
    if (arg === '--raster-cache' || arg.startsWith('--raster-cache=')) {
      const taken = takeValue(argv, i, '--raster-cache');
      args.rasterCacheDir = path.resolve(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '-o' || arg === '--out' || arg.startsWith('--out=')) {
      const taken = takeValue(argv, i, '--out');
      args.output = path.resolve(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--dir' || arg.startsWith('--dir=')) {
      const taken = takeValue(argv, i, '--dir');
      args.stageDir = path.resolve(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--only' || arg.startsWith('--only=')) {
      const taken = takeValue(argv, i, '--only');
      args.only = parseOnlyTokens(taken.value);
      i = taken.next;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (formats) {
    args.vectorFormats = formats.vectors.length > 0 ? formats.vectors : [];
    args.rasterFormats = formats.rasters.length > 0 ? formats.rasters : [];
    if (formats.vectors.length === 0) {
      args.includeVectors = false;
    }
    if (formats.rasters.length === 0) {
      args.includeRasters = false;
    }
  }
  if (crsList) {
    args.vectorCrsList = crsList;
    args.rasterCrsList = crsList;
  }
  if (noRasters) {
    args.includeRasters = false;
  }
  if (rastersOnly) {
    args.includeVectors = false;
    args.includeRasters = true;
  }

  return args;
};

const plannedCases = (args: SuiteArgs): SpatialTestCase[] =>
  applySizesToCases(
    buildSuiteTestCases({
      vectorFormats: args.vectorFormats,
      rasterFormats: args.rasterFormats,
      vectorCrsList: args.vectorCrsList,
      rasterCrsList: args.rasterCrsList,
      only: args.only,
      includeVectors: args.includeVectors,
      includeRasters: args.includeRasters,
    }),
    args.sizeBytes,
    args.rasterSizeBytes
  );

const existingNearTarget = (
  filePath: string,
  targetBytes: number,
  testCase: SpatialTestCase
): boolean => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const {size} = fs.statSync(filePath);
  if (size <= 0) {
    return false;
  }
  const companionsPresent = testCase.companionFilenames.every(name =>
    fs.existsSync(path.join(path.dirname(filePath), name))
  );
  if (!companionsPresent) {
    return false;
  }
  if (testCase.kind === 'raster' && testCase.format !== 'geotiff') {
    return true;
  }
  return size >= Math.min(targetBytes * 0.15, targetBytes);
};

const writeZip = async (stageDir: string, zipPath: string): Promise<number> => {
  await fs.promises.mkdir(path.dirname(zipPath), {recursive: true});
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {zlib: {level: 6}});
  archive.on('warning', err => {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  });
  archive.pipe(output);
  archive.directory(stageDir, 'spatial-test-suite');
  const done = finished(output);
  await archive.finalize();
  await done;
  return archive.pointer();
};

const log = (...args: unknown[]): void => {
  console.error('[spatial-suite]', ...args);
};

const generateCase = async (
  testCase: SpatialTestCase,
  filePath: string,
  args: SuiteArgs
): Promise<{bytes: number; features: number}> => {
  if (testCase.kind === 'raster') {
    const written = await writeRasterTestCase({
      cacheDir: args.rasterCacheDir,
      outputDir: path.dirname(filePath),
      filename: testCase.filename,
      format: testCase.format,
      crs: testCase.crs,
      targetBytes: args.rasterSizeBytes,
    });
    return {bytes: written.bytes, features: 0};
  }
  const generateArgs: CliArgs = {
    ...defaultCliArgs(),
    ...testCase.profile.options,
    sizeBytes: args.sizeBytes,
    featureCount: undefined,
    output: filePath,
    quiet: true,
    dryRun: false,
    help: false,
    name: testCase.id,
    format: testCase.format,
    crs: testCase.crs,
  };
  const generated = await generateExampleGeoJSON(generateArgs);
  return {bytes: generated.bytes, features: generated.features};
};

const main = async (): Promise<void> => {
  let args: SuiteArgs;
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

  const cases = plannedCases(args);
  if (cases.length === 0) {
    console.error('No test cases matched the filters.');
    process.exit(1);
  }

  if (args.list || args.dryRun) {
    console.log(
      JSON.stringify(
        {
          sizeBytes: args.sizeBytes,
          rasterSizeBytes: args.rasterSizeBytes,
          formats: {
            vector: args.vectorFormats ?? [...SPATIAL_FORMATS],
            raster: args.rasterFormats ?? [...RASTER_FORMATS],
          },
          crs: {
            vector: args.vectorCrsList ?? [WGS84],
            raster: args.rasterCrsList ?? [...RASTER_DEFAULT_CRS],
          },
          includeVectors: args.includeVectors,
          includeRasters: args.includeRasters,
          cases: cases.map(testCase => ({
            id: testCase.id,
            kind: testCase.kind,
            filename: testCase.filename,
            companions: testCase.companionFilenames,
            format: testCase.format,
            crs: testCase.crs,
            description: testCase.description,
          })),
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const stageDir =
    args.stageDir ?? path.join(path.dirname(args.output), 'spatial-test-suite');
  await fs.promises.mkdir(stageDir, {recursive: true});
  log(
    `building ${cases.length} case(s) (vector ${formatBytes(args.sizeBytes)}, raster ${formatBytes(args.rasterSizeBytes)}) -> ${stageDir}`
  );

  const results: Array<{
    id: string;
    kind: SpatialTestCase['kind'];
    filename: string;
    companions: string[];
    format: SpatialTestCase['format'];
    crs: string;
    bytes: number;
    features: number;
    skipped: boolean;
  }> = [];

  for (const [index, testCase] of cases.entries()) {
    const filePath = path.join(stageDir, testCase.filename);
    const targetBytes =
      testCase.kind === 'raster' ? args.rasterSizeBytes : args.sizeBytes;
    log(
      `(${index + 1}/${cases.length}) ${testCase.id} -> ${testCase.filename}`
    );
    if (
      args.skipExisting &&
      existingNearTarget(filePath, targetBytes, testCase)
    ) {
      const {size} = fs.statSync(filePath);
      log(`  skip existing ${formatBytes(size)}`);
      results.push({
        id: testCase.id,
        kind: testCase.kind,
        filename: testCase.filename,
        companions: testCase.companionFilenames,
        format: testCase.format,
        crs: testCase.crs,
        bytes: size,
        features: 0,
        skipped: true,
      });
      continue;
    }
    const generated = await generateCase(testCase, filePath, args);
    log(
      testCase.kind === 'raster'
        ? `  wrote ${formatBytes(generated.bytes)}${testCase.companionFilenames.length > 0 ? ` + ${testCase.companionFilenames.join(', ')}` : ''}`
        : `  wrote ${formatBytes(generated.bytes)} (${generated.features} features)`
    );
    results.push({
      id: testCase.id,
      kind: testCase.kind,
      filename: testCase.filename,
      companions: testCase.companionFilenames,
      format: testCase.format,
      crs: testCase.crs,
      bytes: generated.bytes,
      features: generated.features,
      skipped: false,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sizeBytes: args.sizeBytes,
    rasterSizeBytes: args.rasterSizeBytes,
    generator: 'buildSpatialTestSuite',
    cases: results,
  };
  await fs.promises.writeFile(
    path.join(stageDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  log(`zipping ${stageDir} -> ${args.output}`);
  const zipBytes = await writeZip(stageDir, args.output);
  log(`wrote ${formatBytes(zipBytes)} archive ${args.output}`);

  if (args.clean) {
    await fs.promises.rm(stageDir, {recursive: true, force: true});
    log(`removed staging directory ${stageDir}`);
  } else {
    log(`staging files kept at ${stageDir}`);
  }
};

main().catch(err => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
