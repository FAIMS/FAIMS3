// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Build a zip of profiled synthetic GeoJSON files for spatial-pipeline tests.
 *
 * Reuses exampleGeoJSONGenerator.ts. Default profiles match the 200MB
 * combinations (nested/flat, mixed/single geometry, consistent/mixed attrs).
 *
 * Usage (from api/):
 *   pnpm run build-geojson-test-suite
 *   pnpm run build-geojson-test-suite -- --size 200MB --out ../tmp/geojson-test-suite.zip
 *   pnpm run build-geojson-test-suite -- --size 1MB --only flat-points,nested-grouped
 *   pnpm run build-geojson-test-suite -- --list
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
  GEOJSON_TEST_PROFILES,
  parseProfileIds,
  profileFilename,
  selectedProfiles,
} from './geojsonTestProfiles';

type SuiteArgs = {
  help: boolean;
  list: boolean;
  dryRun: boolean;
  clean: boolean;
  skipExisting: boolean;
  sizeBytes: number;
  output: string;
  stageDir: string | undefined;
  only: string[] | undefined;
};

const DEFAULT_SIZE_BYTES = 200 * 1024 * 1024;
const DEFAULT_ZIP = path.resolve('../tmp/geojson-test-suite.zip');

const showHelp = (): void => {
  console.log(`Usage: pnpm run build-geojson-test-suite [options]

Generate the profiled GeoJSON test suite and zip it.

Options:
  --size <bytes>     Target size per file (default: 200MB). e.g. 200MB, 5m, 250kb
  -o, --out <path>   Zip path (default: ../tmp/geojson-test-suite.zip)
  --dir <path>       Staging directory for the .geojson files
                     (default: <zip-dir>/geojson-test-suite)
  --only id,id       Generate a subset of profiles
  --skip-existing    Reuse a staging file if it is already near the target size
  --clean            Delete the staging directory after a successful zip
  --list             Print profiles and exit
  --dry-run          Print the plan; do not write files
  -h, --help         Show this help

Profiles:
${GEOJSON_TEST_PROFILES.map(profile => `  ${profile.id.padEnd(24)} ${profile.description}`).join('\n')}

Examples:
  pnpm run build-geojson-test-suite -- --size 200MB --out ../tmp/geojson-test-suite.zip
  pnpm run build-geojson-test-suite -- --size 1MB --only flat-points,nested-grouped
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
    only: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
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
      args.only = parseProfileIds(taken.value);
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

const existingNearTarget = (filePath: string, targetBytes: number): boolean => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const {size} = fs.statSync(filePath);
  return size >= targetBytes * 0.9 && size <= targetBytes * 1.15;
};

const writeZip = async (stageDir: string, zipPath: string): Promise<number> => {
  await fs.promises.mkdir(path.dirname(zipPath), {recursive: true});
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {zlib: {level: 6}});
  archive.on('warning', err => {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    console.warn(`[geojson-suite] zip warning: ${err.message}`);
  });
  archive.pipe(output);
  archive.directory(stageDir, 'geojson-test-suite');
  const done = finished(output);
  await archive.finalize();
  await done;
  return archive.pointer();
};

const log = (...args: unknown[]): void => {
  console.error('[geojson-suite]', ...args);
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

  if (args.list) {
    for (const profile of GEOJSON_TEST_PROFILES) {
      console.log(`${profile.id}\t${profile.description}`);
    }
    process.exit(0);
  }

  const profiles = selectedProfiles(args.only);
  const stageDir =
    args.stageDir ?? path.join(path.dirname(args.output), 'geojson-test-suite');

  const planned = profiles.map(profile => ({
    id: profile.id,
    filename: profileFilename(args.sizeBytes, profile.id),
    description: profile.description,
    size: formatBytes(args.sizeBytes),
  }));

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          output: args.output,
          stageDir,
          sizeBytes: args.sizeBytes,
          clean: args.clean,
          skipExisting: args.skipExisting,
          profiles: planned,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  await fs.promises.mkdir(stageDir, {recursive: true});
  log(
    `building ${profiles.length} profile(s) at ${formatBytes(args.sizeBytes)} each -> ${stageDir}`
  );

  const results: Array<{
    id: string;
    filename: string;
    description: string;
    bytes: number;
    features: number;
    skipped: boolean;
  }> = [];

  for (const [index, profile] of profiles.entries()) {
    const filename = profileFilename(args.sizeBytes, profile.id);
    const output = path.join(stageDir, filename);
    log(`(${index + 1}/${profiles.length}) ${profile.id} -> ${filename}`);

    if (args.skipExisting && existingNearTarget(output, args.sizeBytes)) {
      const {size} = fs.statSync(output);
      log(`  skip existing ${formatBytes(size)}`);
      results.push({
        id: profile.id,
        filename,
        description: profile.description,
        bytes: size,
        features: 0,
        skipped: true,
      });
      continue;
    }

    const generateArgs: CliArgs = {
      ...defaultCliArgs(),
      ...profile.options,
      sizeBytes: args.sizeBytes,
      featureCount: undefined,
      output,
      quiet: true,
      dryRun: false,
      help: false,
      name: profile.id,
    };
    const startedAt = Date.now();
    const generated = await generateExampleGeoJSON(generateArgs);
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(
      `  wrote ${formatBytes(generated.bytes)} (${generated.features} features) in ${elapsedSec}s`
    );
    results.push({
      id: profile.id,
      filename,
      description: profile.description,
      bytes: generated.bytes,
      features: generated.features,
      skipped: false,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sizeBytes: args.sizeBytes,
    size: formatBytes(args.sizeBytes),
    generator: 'buildGeojsonTestSuite',
    profiles: results,
  };
  const manifestPath = path.join(stageDir, 'manifest.json');
  await fs.promises.writeFile(
    manifestPath,
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
