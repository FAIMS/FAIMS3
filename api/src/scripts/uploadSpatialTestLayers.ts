// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Generate the cross-format spatial suite and upload each file as a map layer.
 *
 * Usage (from api/):
 *   FAIMS_API_TOKEN=... pnpm run upload-spatial-test-layers -- http://localhost:8080
 *   pnpm run upload-spatial-test-layers -- --api http://localhost:8080 \
 *     --formats kml,gpkg,shapefile,gdb --crs EPSG:4326,EPSG:3857 --size 10MB
 */
import {File} from 'node:buffer';
import {openAsBlob} from 'node:fs';
import * as fs from 'fs';
import * as path from 'path';
import {ConductorClient, readResponseBody} from './conductorClient';
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
  SPATIAL_FORMAT_INFO,
  parseCrsList,
  parseSpatialFormats,
  type SpatialFormat,
} from './spatialTestFormats';

type UploadArgs = {
  help: boolean;
  list: boolean;
  dryRun: boolean;
  clean: boolean;
  skipExisting: boolean;
  sizeBytes: number;
  apiUrl: string | undefined;
  teamId: string | undefined;
  namePrefix: string;
  stageDir: string;
  formats: SpatialFormat[] | undefined;
  crsList: string[] | undefined;
  only: string[] | undefined;
};

const DEFAULT_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_STAGE_DIR = path.resolve('../tmp/spatial-upload-layers');
const DEFAULT_NAME_PREFIX = 'Spatial test';
const NAME_MAX = 100;
const NAME_MIN = 5;
const DESCRIPTION_MAX = 250;

const showHelp = (): void => {
  console.log(`Usage: pnpm run upload-spatial-test-layers -- <api-url> [options]

Generate each format/profile/CRS case and POST it to /api/map-assets.

Auth:
  FAIMS_API_TOKEN   Long-lived token (required)

Arguments:
  <api-url> / --api <url>   Conductor base URL

Options:
  --size <bytes>         GeoJSON budget per case before conversion (default: 10MB)
  --formats a,b          geojson,kml,gpkg,shapefile,gdb (default: all)
  --crs EPSG:4326,...    CRS list (default: EPSG:4326). KML stays WGS84.
  --team-id <id>         Own layers on this team
  --name-prefix <text>   Layer name prefix (default: "Spatial test")
  --dir <path>           Staging directory
  --only token,token     Format, geometry profile id, or case id
  --skip-existing        Reuse a staged file if present
  --clean                Delete generated files after upload
  --list / --dry-run     Plan only
  -h, --help             Show this help
`);
};

const log = (...args: unknown[]): void => {
  console.error('[spatial-upload]', ...args);
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

const normalizeApiUrl = (raw: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `API URL must start with http:// or https:// (got '${raw}')`
    );
  }
  return trimmed;
};

const parseArgs = (argv: string[]): UploadArgs => {
  const args: UploadArgs = {
    help: false,
    list: false,
    dryRun: false,
    clean: false,
    skipExisting: false,
    sizeBytes: DEFAULT_SIZE_BYTES,
    apiUrl: undefined,
    teamId: undefined,
    namePrefix: DEFAULT_NAME_PREFIX,
    stageDir: DEFAULT_STAGE_DIR,
    formats: undefined,
    crsList: undefined,
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
    if (arg === '--api' || arg.startsWith('--api=')) {
      const taken = takeValue(argv, i, '--api');
      args.apiUrl = normalizeApiUrl(taken.value);
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
    if (arg === '--team-id' || arg.startsWith('--team-id=')) {
      const taken = takeValue(argv, i, '--team-id');
      args.teamId = taken.value.trim();
      i = taken.next;
      continue;
    }
    if (arg === '--name-prefix' || arg.startsWith('--name-prefix=')) {
      const taken = takeValue(argv, i, '--name-prefix');
      args.namePrefix = taken.value.trim();
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
    if (args.apiUrl) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    args.apiUrl = normalizeApiUrl(arg);
  }

  return args;
};

const clip = (value: string, max: number): string =>
  value.length <= max ? value : value.slice(0, max).trimEnd();

const layerName = (prefix: string, testCase: SpatialTestCase): string => {
  const crsBit = testCase.crs.replace('EPSG:', '');
  const full = `${prefix} ${testCase.format} ${testCase.profile.id} ${crsBit}`;
  const clipped = clip(full, NAME_MAX);
  if (clipped.length < NAME_MIN) {
    throw new Error(`Layer name is shorter than ${NAME_MIN} characters`);
  }
  return clipped;
};

const plannedCases = (args: UploadArgs): SpatialTestCase[] =>
  applySizeToCases(
    buildSpatialTestCases({
      formats: args.formats,
      crsList: args.crsList,
      only: args.only,
    }),
    args.sizeBytes
  );

const uploadMapLayer = async ({
  client,
  filePath,
  filename,
  name,
  description,
  teamId,
  mediaType,
}: {
  client: ConductorClient;
  filePath: string;
  filename: string;
  name: string;
  description: string;
  teamId: string | undefined;
  mediaType: string;
}): Promise<{id: string; status: string}> => {
  const blob = await openAsBlob(filePath, {type: mediaType});
  const file = new File([blob], filename, {type: mediaType});
  const body = new FormData();
  body.set('name', name);
  body.set('description', description);
  if (teamId) {
    body.set('teamId', teamId);
  }
  body.append('files', file);

  const response = await client.request('/api/map-assets', {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    const detail = await readResponseBody(response);
    throw new Error(`Upload failed (${response.status}): ${detail}`);
  }
  const asset = (await response.json()) as {
    _id?: unknown;
    status?: unknown;
  };
  if (typeof asset._id !== 'string') {
    throw new Error('Upload succeeded but the response had no asset id');
  }
  return {
    id: asset._id,
    status: typeof asset.status === 'string' ? asset.status : 'unknown',
  };
};

const main = async (): Promise<void> => {
  let args: UploadArgs;
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

  const token = process.env.FAIMS_API_TOKEN?.trim();
  if (args.list || args.dryRun) {
    console.log(
      JSON.stringify(
        {
          apiUrl: args.apiUrl,
          teamId: args.teamId,
          sizeBytes: args.sizeBytes,
          tokenConfigured: Boolean(token),
          cases: cases.map(testCase => ({
            id: testCase.id,
            filename: testCase.filename,
            layerName: layerName(args.namePrefix, testCase),
            format: testCase.format,
            crs: testCase.crs,
            description: clip(testCase.description, DESCRIPTION_MAX),
          })),
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (!token) {
    console.error('FAIMS_API_TOKEN is required (long-lived API token).');
    process.exit(1);
  }
  if (!args.apiUrl) {
    console.error('API URL is required (positional or --api).');
    showHelp();
    process.exit(1);
  }

  const client = new ConductorClient(args.apiUrl, token);
  await client.exchange();
  await fs.promises.mkdir(args.stageDir, {recursive: true});
  log(
    `uploading ${cases.length} layer(s) at ${formatBytes(args.sizeBytes)} GeoJSON each to ${args.apiUrl}`
  );

  const failures: string[] = [];
  for (const [index, testCase] of cases.entries()) {
    const filePath = path.join(args.stageDir, testCase.filename);
    const name = layerName(args.namePrefix, testCase);
    const description = clip(testCase.description, DESCRIPTION_MAX);
    const mediaType = SPATIAL_FORMAT_INFO[testCase.format].mediaType;
    log(`(${index + 1}/${cases.length}) ${testCase.id} -> ${name}`);

    try {
      if (args.skipExisting && fs.existsSync(filePath)) {
        log(`  reuse ${testCase.filename}`);
      } else {
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
        log(
          `  generated ${formatBytes(generated.bytes)} (${generated.features} features)`
        );
      }

      const uploaded = await uploadMapLayer({
        client,
        filePath,
        filename: testCase.filename,
        name,
        description,
        teamId: args.teamId,
        mediaType,
      });
      log(`  uploaded ${uploaded.id} (${uploaded.status})`);
      if (args.clean) {
        await fs.promises.rm(filePath, {force: true});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  FAILED ${testCase.id}: ${message}`);
      failures.push(`${testCase.id}: ${message}`);
    }
  }

  if (args.clean) {
    await fs.promises
      .rm(args.stageDir, {recursive: true, force: true})
      .catch(() => undefined);
  }

  if (failures.length > 0) {
    console.error(
      `[spatial-upload] ${failures.length} case(s) failed:\n${failures.map(item => `  ${item}`).join('\n')}`
    );
    process.exit(1);
  }
  log('all layers uploaded');
};

main().catch(err => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
