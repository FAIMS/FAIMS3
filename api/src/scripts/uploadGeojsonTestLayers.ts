// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Generate the profiled GeoJSON suite and upload each file as a map layer.
 *
 * Exchanges FAIMS_API_TOKEN (long-lived) for a short-lived access JWT via
 * POST /api/auth/exchange-long-lived-token, then refreshes by re-exchanging
 * before expiry or on 401. Access tokens last ~5 minutes and are not
 * refresh-token based.
 *
 * Usage (from api/):
 *   FAIMS_API_TOKEN=... pnpm run upload-geojson-test-layers -- http://localhost:8080
 *   pnpm run upload-geojson-test-layers -- --api https://conductor.example \
 *     --size 100MB --team-id <teamId>
 */
import {openAsBlob} from 'node:fs';
import * as fs from 'fs';
import * as path from 'path';
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
  sizeToken,
  type GeoJsonTestProfile,
} from './geojsonTestProfiles';

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
  only: string[] | undefined;
};

const DEFAULT_SIZE_BYTES = 100 * 1024 * 1024;
const DEFAULT_STAGE_DIR = path.resolve('../tmp/geojson-upload-layers');
const DEFAULT_NAME_PREFIX = 'GeoJSON test';
const TOKEN_REFRESH_SKEW_MS = 60_000;
const NAME_MAX = 100;
const NAME_MIN = 5;
const DESCRIPTION_MAX = 250;

const showHelp = (): void => {
  console.log(`Usage: pnpm run upload-geojson-test-layers -- <api-url> [options]

Generate each profiled GeoJSON file and POST it to /api/map-assets.

Auth:
  FAIMS_API_TOKEN   Long-lived token (required). Exchanged for a short-lived
                    access JWT; re-exchanged before expiry and on 401.

Arguments:
  <api-url>              Conductor base URL, e.g. http://localhost:8080
  --api <url>            Same as the positional API URL

Options:
  --size <bytes>         Target size per file (default: 100MB)
  --team-id <id>         Own layers on this team (omit for personal library)
  --name-prefix <text>   Layer name prefix (default: "GeoJSON test")
  --dir <path>           Staging directory for generated files
                         (default: ../tmp/geojson-upload-layers)
  --only id,id           Upload a subset of profiles
  --skip-existing        Reuse a staging file if it is already near the target size
  --clean                Delete generated files after a successful upload
  --list                 Print profiles and exit
  --dry-run              Print the plan; do not generate or upload
  -h, --help             Show this help

Profiles:
${GEOJSON_TEST_PROFILES.map(profile => `  ${profile.id.padEnd(24)} ${profile.description}`).join('\n')}

Examples:
  FAIMS_API_TOKEN=... pnpm run upload-geojson-test-layers -- http://localhost:8080
  pnpm run upload-geojson-test-layers -- --api http://localhost:8080 --size 20MB --only flat-points
`);
};

const log = (...args: unknown[]): void => {
  console.error('[geojson-upload]', ...args);
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
    if (arg === '--team-id' || arg.startsWith('--team-id=')) {
      const taken = takeValue(argv, i, '--team-id');
      if (!taken.value.trim()) {
        throw new Error('--team-id must not be empty');
      }
      args.teamId = taken.value.trim();
      i = taken.next;
      continue;
    }
    if (arg === '--name-prefix' || arg.startsWith('--name-prefix=')) {
      const taken = takeValue(argv, i, '--name-prefix');
      if (!taken.value.trim()) {
        throw new Error('--name-prefix must not be empty');
      }
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
      args.only = parseProfileIds(taken.value);
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

const layerName = (
  prefix: string,
  profileId: string,
  bytes: number
): string => {
  const token = sizeToken(bytes);
  const full = `${prefix} ${profileId} (${token})`;
  if (full.length >= NAME_MIN && full.length <= NAME_MAX) {
    return full;
  }
  const clipped = clip(full, NAME_MAX);
  if (clipped.length < NAME_MIN) {
    throw new Error(`Layer name is shorter than ${NAME_MIN} characters`);
  }
  return clipped;
};

const layerDescription = (profile: GeoJsonTestProfile): string =>
  clip(profile.description, DESCRIPTION_MAX);

const existingNearTarget = (filePath: string, targetBytes: number): boolean => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const {size} = fs.statSync(filePath);
  return size >= targetBytes * 0.9 && size <= targetBytes * 1.15;
};

const jwtExpiryMs = (token: string): number | undefined => {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    return undefined;
  }
  try {
    const json = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as {exp?: unknown};
    return typeof json.exp === 'number' ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
};

const readResponseBody = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as {message?: string; error?: string};
    return json.message ?? json.error ?? text;
  } catch {
    return text;
  }
};

class ConductorClient {
  private accessToken: string | undefined;
  private expiresAtMs = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly longLivedToken: string
  ) {}

  async exchange(): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/auth/exchange-long-lived-token`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: this.longLivedToken}),
      }
    );
    if (!response.ok) {
      const detail = await readResponseBody(response);
      throw new Error(
        `Long-lived token exchange failed (${response.status}): ${detail}`
      );
    }
    const body = (await response.json()) as {token?: unknown};
    if (typeof body.token !== 'string' || body.token.length === 0) {
      throw new Error('Token exchange did not return an access token');
    }
    this.accessToken = body.token;
    this.expiresAtMs = jwtExpiryMs(body.token) ?? Date.now() + 4 * 60 * 1000;
    log(
      `access token refreshed (expires in ${Math.max(0, Math.round((this.expiresAtMs - Date.now()) / 1000))}s)`
    );
    return this.accessToken;
  }

  async accessTokenFresh(): Promise<string> {
    if (
      !this.accessToken ||
      Date.now() >= this.expiresAtMs - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.exchange();
    }
    return this.accessToken;
  }

  async request(
    apiPath: string,
    init: RequestInit,
    retryOnUnauthorized = true
  ): Promise<Response> {
    const token = await this.accessTokenFresh();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      ...init,
      headers,
    });
    if (response.status === 401 && retryOnUnauthorized) {
      log('access token rejected; re-exchanging long-lived token');
      await this.exchange();
      return this.request(apiPath, init, false);
    }
    return response;
  }
}

const generateProfileFile = async (
  profile: GeoJsonTestProfile,
  filePath: string,
  sizeBytes: number,
  skipExisting: boolean
): Promise<{bytes: number; features: number; skipped: boolean}> => {
  if (skipExisting && existingNearTarget(filePath, sizeBytes)) {
    const {size} = fs.statSync(filePath);
    return {bytes: size, features: 0, skipped: true};
  }
  const generateArgs: CliArgs = {
    ...defaultCliArgs(),
    ...profile.options,
    sizeBytes,
    featureCount: undefined,
    output: filePath,
    quiet: true,
    dryRun: false,
    help: false,
    name: profile.id,
  };
  const generated = await generateExampleGeoJSON(generateArgs);
  return {
    bytes: generated.bytes,
    features: generated.features,
    skipped: false,
  };
};

const uploadMapLayer = async ({
  client,
  filePath,
  filename,
  name,
  description,
  teamId,
}: {
  client: ConductorClient;
  filePath: string;
  filename: string;
  name: string;
  description: string;
  teamId: string | undefined;
}): Promise<{id: string; status: string}> => {
  const blob = await openAsBlob(filePath, {type: 'application/geo+json'});
  const body = new FormData();
  body.set('name', name);
  body.set('description', description);
  if (teamId) {
    body.set('teamId', teamId);
  }
  body.append('files', blob, filename);

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

  if (args.list) {
    for (const profile of GEOJSON_TEST_PROFILES) {
      console.log(`${profile.id}\t${profile.description}`);
    }
    process.exit(0);
  }

  const token = process.env.FAIMS_API_TOKEN?.trim();
  if (!args.dryRun && !token) {
    console.error('FAIMS_API_TOKEN is required (long-lived API token).');
    process.exit(1);
  }
  if (!args.apiUrl) {
    console.error('API URL is required (positional or --api).');
    showHelp();
    process.exit(1);
  }

  const profiles = selectedProfiles(args.only);
  const planned = profiles.map(profile => {
    const filename = profileFilename(args.sizeBytes, profile.id);
    return {
      id: profile.id,
      filename,
      layerName: layerName(args.namePrefix, profile.id, args.sizeBytes),
      description: layerDescription(profile),
      size: formatBytes(args.sizeBytes),
    };
  });

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          apiUrl: args.apiUrl,
          teamId: args.teamId,
          sizeBytes: args.sizeBytes,
          stageDir: args.stageDir,
          tokenConfigured: Boolean(token),
          profiles: planned,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const client = new ConductorClient(args.apiUrl, token!);
  await client.exchange();
  await fs.promises.mkdir(args.stageDir, {recursive: true});

  log(
    `uploading ${profiles.length} layer(s) at ${formatBytes(args.sizeBytes)} each to ${args.apiUrl}`
  );

  const failures: string[] = [];
  for (const [index, profile] of profiles.entries()) {
    const filename = profileFilename(args.sizeBytes, profile.id);
    const filePath = path.join(args.stageDir, filename);
    const name = layerName(args.namePrefix, profile.id, args.sizeBytes);
    const description = layerDescription(profile);
    log(`(${index + 1}/${profiles.length}) ${profile.id} -> ${name}`);

    try {
      const generated = await generateProfileFile(
        profile,
        filePath,
        args.sizeBytes,
        args.skipExisting
      );
      log(
        generated.skipped
          ? `  reuse ${formatBytes(generated.bytes)} ${filename}`
          : `  generated ${formatBytes(generated.bytes)} (${generated.features} features)`
      );

      const uploaded = await uploadMapLayer({
        client,
        filePath,
        filename,
        name,
        description,
        teamId: args.teamId,
      });
      log(`  uploaded ${uploaded.id} (${uploaded.status})`);

      if (args.clean) {
        await fs.promises.rm(filePath, {force: true});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  FAILED ${profile.id}: ${message}`);
      failures.push(`${profile.id}: ${message}`);
    }
  }

  if (args.clean) {
    await fs.promises
      .rm(args.stageDir, {recursive: true, force: true})
      .catch(() => undefined);
  }

  if (failures.length > 0) {
    console.error(
      `[geojson-upload] ${failures.length} profile(s) failed:\n${failures.map(item => `  ${item}`).join('\n')}`
    );
    process.exit(1);
  }
  log('all layers uploaded');
};

main().catch(err => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
