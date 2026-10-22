// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Build a zip of profiled vector files across GeoJSON, KML, GeoPackage,
 * shapefile, and FileGDB.
 *
 * Usage (from api/):
 *   pnpm run build-spatial-test-suite -- --size 10MB
 *   pnpm run build-spatial-test-suite -- --formats kml,gpkg --crs EPSG:4326,EPSG:3857
 *   pnpm run build-spatial-test-suite -- --only flat-points,gdb
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
  applySizeToCases,
  buildSpatialTestCases,
  parseOnlyTokens,
  type SpatialTestCase,
} from './spatialTestProfiles';
import {
  SPATIAL_FORMATS,
  WGS84,
  parseCrsList,
  parseSpatialFormats,
  type SpatialFormat,
} from './spatialTestFormats';

type SuiteArgs = {
  help: boolean;
  list: boolean;
  dryRun: boolean;
  clean: boolean;
  skipExisting: boolean;
  sizeBytes: number;
  output: string;
  stageDir: string | undefined;
  formats: SpatialFormat[] | undefined;
  crsList: string[] | undefined;
  only: string[] | undefined;
};

const DEFAULT_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ZIP = path.resolve('../tmp/spatial-test-suite.zip');

const showHelp = (): void => {
  console.log(`Usage: pnpm run build-spatial-test-suite [options]

Generate a cross-format map-layer fixture suite and zip it.

Options:
  --size <bytes>        Target GeoJSON size per case before conversion
                        (default: 10MB)
  --formats a,b         geojson,kml,gpkg,shapefile,gdb (default: all)
  --crs EPSG:4326,...   CRS list (default: EPSG:4326). KML stays WGS84.
  -o, --out <path>      Zip path (default: ../tmp/spatial-test-suite.zip)
  --dir <path>          Staging directory
  --only token,token    Format, geometry profile id, or case id
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
    output: DEFAULT_ZIP,
    stageDir: undefined,
    formats: undefined,
    crsList: undefined,
    only: undefined,
  };

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
      args.formats = parseSpatialFormats(taken.value);
      i = taken.next;
      continue;
    }
    if (arg === '--crs' || arg.startsWith('--crs=')) {
      const taken = takeValue(argv, i, '--crs');
      args.crsList = parseCrsList(taken.value);
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

  return args;
};

const plannedCases = (args: SuiteArgs): SpatialTestCase[] =>
  applySizeToCases(
    buildSpatialTestCases({
      formats: args.formats,
      crsList: args.crsList,
      only: args.only,
    }),
    args.sizeBytes
  );

const existingNearTarget = (filePath: string, targetBytes: number): boolean => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const {size} = fs.statSync(filePath);
  return size >= Math.min(targetBytes * 0.15, targetBytes) && size > 0;
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
  sizeBytes: number
): Promise<{bytes: number; features: number}> => {
  const generateArgs: CliArgs = {
    ...defaultCliArgs(),
    ...testCase.profile.options,
    sizeBytes,
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
          formats: args.formats ?? [...SPATIAL_FORMATS],
          crs: args.crsList ?? [WGS84],
          cases: cases.map(testCase => ({
            id: testCase.id,
            filename: testCase.filename,
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
    `building ${cases.length} case(s) at ${formatBytes(args.sizeBytes)} GeoJSON each -> ${stageDir}`
  );

  const results: Array<{
    id: string;
    filename: string;
    format: SpatialFormat;
    crs: string;
    bytes: number;
    features: number;
    skipped: boolean;
  }> = [];

  for (const [index, testCase] of cases.entries()) {
    const filePath = path.join(stageDir, testCase.filename);
    log(
      `(${index + 1}/${cases.length}) ${testCase.id} -> ${testCase.filename}`
    );
    if (args.skipExisting && existingNearTarget(filePath, args.sizeBytes)) {
      const {size} = fs.statSync(filePath);
      log(`  skip existing ${formatBytes(size)}`);
      results.push({
        id: testCase.id,
        filename: testCase.filename,
        format: testCase.format,
        crs: testCase.crs,
        bytes: size,
        features: 0,
        skipped: true,
      });
      continue;
    }
    const generated = await generateCase(testCase, filePath, args.sizeBytes);
    log(
      `  wrote ${formatBytes(generated.bytes)} (${generated.features} features)`
    );
    results.push({
      id: testCase.id,
      filename: testCase.filename,
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
