import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseBuildConfig} from './build-config.js';

const HELP_TEXT = `Usage: pnpm --filter=@faims3/build-config run generate -- [--config path/to/config.json] [--platform all|android|ios|web] [--out path/to/.env]

Generates a build environment file from the shared config JSON used by the app and web builds.
`;

type Value = string | number | boolean | undefined | null;

export type SupportedPlatform = 'all' | 'android' | 'ios' | 'web';

export interface GenerateBuildConfigArgs {
  help?: boolean;
  config?: string;
  platform?: string;
  target?: string;
  out?: string;
}

function readConfigJson(configArg: string, cwd = process.cwd()): unknown {
  if (configArg === 'true') {
    const stdin = fs.readFileSync(0, 'utf8').trim();
    if (!stdin) {
      throw new Error('No config JSON was provided on stdin.');
    }
    return JSON.parse(stdin);
  }

  const configPath = path.resolve(cwd, configArg);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export function parseArgs(argv: string[]): GenerateBuildConfigArgs {
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
      continue;
    }

    if (token.startsWith('-')) {
      const key = token.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }

  return args as GenerateBuildConfigArgs;
}

function coalesce<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function boolToEnv(value: unknown): string {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' ? 'true' : 'false';
  }
  return value ? 'true' : 'false';
}

function stringify(value: Value): string {
  if (typeof value === 'string') {
    return value.replace(/\r?\n/g, '\\n');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return (value as Array<string | number | boolean>).join(',');
  }
  return '';
}

function resolveGitCommitVersion(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const placeholderPattern = /^output\s+of\s+`?git rev-parse HEAD`?$/i;

  if (raw && !placeholderPattern.test(raw)) {
    return raw;
  }

  try {
    const resolved = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
    return resolved || 'local-build';
  } catch {
    return raw || 'local-build';
  }
}

function buildEnvMap(
  config: ReturnType<typeof parseBuildConfig>,
  platform: SupportedPlatform,
  options: {includeEmpty?: boolean} = {}
) {
  const {includeEmpty = false} = options;
  const {app, web, mobile, urls} = config;
  const commitVersion = resolveGitCommitVersion(app.commitVersion);

  const base = {
    VITE_APP_NAME: coalesce<string>(
      app.appName,
      web.appName as string | undefined,
      'FAIMS'
    ),
    VITE_APP_SHORT_NAME: coalesce(app.appShortName, app.appName, 'FAIMS'),
    VITE_CLUSTER_ADMIN_GROUP_NAME: coalesce<string>(
      app.clusterAdminGroupName as string | undefined,
      'cluster-admin'
    ),
    VITE_COMMIT_VERSION: commitVersion,
    VITE_CONDUCTOR_URL: coalesce(urls.apiUrl, 'http://localhost:8080'),
    VITE_API_URL: coalesce(urls.apiUrl, 'http://localhost:8080'),
    VITE_WEB_URL: coalesce(urls.webUrl, 'http://localhost:3001'),
    VITE_APP_URL: coalesce(urls.appUrl, 'http://localhost:3000'),
    VITE_WEBSITE_TITLE: coalesce(web.websiteTitle, 'Control Centre'),
    VITE_APP_THEME: coalesce(app.theme, 'default'),
    VITE_THEME: coalesce(app.theme, 'default'),
    VITE_NOTEBOOK_NAME: coalesce(app.notebookName, 'notebook'),
    VITE_NOTEBOOK_LIST_TYPE: coalesce(app.notebookListType, 'tabs'),
    VITE_APP_ID: coalesce<string>(
      app.appId,
      mobile.android?.appId as string | undefined,
      mobile.ios?.bundleIdentifier as string | undefined,
      'org.fedarch.faims3'
    ),
    VITE_HEADING_APP_NAME: coalesce(
      app.headingAppName,
      app.appName,
      web.appName as string | undefined,
      'FAIMS'
    ),
    VITE_APP_PRIVACY_POLICY_URL: coalesce(
      app.privacyPolicyUrl,
      web.privacyPolicyUrl,
      'https://fieldnote.au/privacy'
    ),
    VITE_SUPPORT_EMAIL: coalesce(app.supportEmail, 'support@fieldmark.au'),
    VITE_APP_CONTACT_URL: coalesce(app.appContactUrl, app.contactUrl, ''),
    VITE_DIRECTORY_USERNAME: coalesce(app.directoryUsername, ''),
    VITE_DIRECTORY_PASSWORD: coalesce(app.directoryPassword, ''),
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: coalesce(
      app.syncPushOnlyRecordThreshold,
      500
    ),
    VITE_TOKEN_REFRESH_INTERVAL_MS: coalesce(app.tokenRefreshIntervalMs, 15000),
    VITE_TOKEN_REFRESH_WINDOW_MS: coalesce(app.tokenRefreshWindowMs, 60000),
    VITE_LOGIN_BANNER_GRACE_MS: coalesce(app.loginBannerGraceMs, 10000),
    VITE_IGNORE_TOKEN_EXP: boolToEnv(coalesce(app.ignoreTokenExp, false)),
    VITE_NAVIGATION: coalesce(app.navigation, 'none'),
    VITE_SHOW_RECORD_LINKS: boolToEnv(coalesce(app.showRecordLinks, false)),
    VITE_ATTACHMENT_SERVICE_TYPE: coalesce(app.attachmentServiceType, 'COUCH'),
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: coalesce(
      app.attachmentDocumentIdPrefix,
      ''
    ),
    VITE_APPLE_BUNDLE_IDENTIFIER: coalesce(
      mobile.ios?.bundleIdentifier,
      app.appId,
      'org.fedarch.faims3'
    ),
    VITE_APP_STORE_CONNECT_TEAM_ID: coalesce(
      mobile.ios?.appStoreConnectTeamId,
      ''
    ),
    VITE_MAP_SOURCE: coalesce(app.mapSource, 'maptiler'),
    VITE_MAP_SOURCE_KEY: coalesce(app.mapSourceKey, ''),
    VITE_SATELLITE_SOURCE: coalesce(app.satelliteSource, ''),
    VITE_MAP_STYLE: coalesce(app.mapStyle, 'basic'),
    VITE_OFFLINE_MAPS: boolToEnv(coalesce(app.offlineMaps, true)),
    VITE_AUTOSUGGEST_SOURCE: coalesce(app.autosuggestSource, 'NONE'),
    VITE_AUTOSUGGEST_MAPBOX_KEY: coalesce(app.autosuggestMapboxKey, ''),
    VITE_AUTOSUGGEST_MAPTILER_KEY: coalesce(app.autosuggestMapTilerKey, ''),
    VITE_MAPBOX_ADDRESS_COUNTRY: coalesce(app.mapboxAddressCountry, 'AU'),
    VITE_MAPTILER_ADDRESS_COUNTRY: coalesce(app.maptilerAddressCountry, 'AU'),
    VITE_MIGRATE_OLD_DATABASES: boolToEnv(
      coalesce(app.migrateOldDatabases, false)
    ),
    VITE_FORCE_REMOTE_DELETION: coalesce(app.forceRemoteDeletion, 'never'),
    VITE_DELETE_ON_DEACTIVATION: boolToEnv(
      coalesce(app.deleteOnDeactivation, false)
    ),
    VITE_BUGSNAG_KEY: coalesce(app.bugsnagApiKey, ''),
    VITE_SHOW_WIPE: boolToEnv(coalesce(app.showWipe, true)),
    VITE_SHOW_POUCHDB_BROWSER: boolToEnv(
      coalesce(app.showPouchDbBrowser, true)
    ),
    VITE_SHOW_NEW_NOTEBOOK: boolToEnv(coalesce(app.showNewNotebook, true)),
    VITE_SHOW_STATUS_TAB: boolToEnv(coalesce(app.showStatusTab, true)),
    VITE_DEBUG_APP: boolToEnv(coalesce(app.debugApp, false)),
    VITE_DEBUG_POUCHDB: boolToEnv(coalesce(app.debugPouchDb, false)),
    VITE_POUCH_BATCH_SIZE: coalesce(app.pouchBatchSize, 10),
    VITE_POUCH_BATCHES_LIMIT: coalesce(app.pouchBatchesLimit, 10),
    VITE_DEVELOPER_MODE: boolToEnv(coalesce(app.developerMode, false)),
    VITE_DOCS_URL: coalesce(web.docsUrl, ''),
    VITE_BUGSNAG_API_KEY: coalesce(app.bugsnagApiKey, ''),
    VITE_MAX_DESIGN_FILE_SIZE_MB: coalesce(web.maxDesignFileSizeMb, 10),
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: coalesce(
      web.maximumLongLivedDurationDays,
      90
    ),
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: coalesce(
      web.longLivedTokenDurationHints,
      [1, 5, 10, 30, 90, 365]
    ),
    VITE_EXCLUDED_TEAM_ROLES: coalesce(app.excludedTeamRoles, []),
  };

  const platformSpecific = {
    android: {
      ANDROID_RELEASE_STATUS: coalesce(mobile.android?.releaseStatus, 'draft'),
      APP_ID: coalesce(app.appId, mobile.android?.appId, 'org.fedarch.faims3'),
      KEYSTORE_FILE: coalesce(mobile.android?.keystoreFileBase64, ''),
      GPLAY_SERVICE_ACCOUNT_KEY_JSON: coalesce(
        mobile.android?.serviceAccountKeyJsonBase64,
        ''
      ),
      JAVA_KEYSTORE: coalesce(mobile.android?.keystorePath, ''),
      JAVA_KEYSTORE_PASSWORD: coalesce(mobile.android?.keystorePassword, ''),
      JAVA_KEY: coalesce(mobile.android?.keyAlias, ''),
      JAVA_KEY_PASSWORD: coalesce(mobile.android?.keyPassword, ''),
      ANDROID_JSON_KEY_FILE: coalesce(
        mobile.android?.serviceAccountJsonPath,
        ''
      ),
    },
    ios: {
      VITE_APPLE_BUNDLE_IDENTIFIER: base.VITE_APPLE_BUNDLE_IDENTIFIER,
      VITE_APP_STORE_CONNECT_TEAM_ID: base.VITE_APP_STORE_CONNECT_TEAM_ID,
      FASTLANE_APPLE_ID: coalesce(mobile.ios?.appleId, ''),
      FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: coalesce(
        mobile.ios?.appleApplicationSpecificPassword,
        ''
      ),
      MATCH_PASSWORD: coalesce(mobile.ios?.matchPassword, ''),
      GIT_AUTHORIZATION: coalesce(mobile.ios?.gitAuthorization, ''),
      PROVISIONING_PROFILE_SPECIFIER: coalesce(
        mobile.ios?.provisioningProfileSpecifier,
        ''
      ),
      APPLE_KEY_ID: coalesce(
        mobile.ios?.appleKeyId,
        mobile.ios?.appleIndividualKeyId,
        ''
      ),
      APPLE_ISSUER_ID: coalesce(mobile.ios?.appleIssuerId, ''),
      APPLE_KEY_CONTENT: coalesce(
        mobile.ios?.appleKeyContent,
        mobile.ios?.appleIndividualKeyContent,
        ''
      ),
    },
  };

  const merged: Record<string, unknown> = {...base};

  if (platform === 'android' || platform === 'all') {
    Object.assign(merged, platformSpecific.android);
  }

  if (platform === 'ios' || platform === 'all') {
    Object.assign(merged, platformSpecific.ios);
  }

  if (platform === 'web' || platform === 'all') {
    merged.VITE_WEB_URL = base.VITE_WEB_URL;
    merged.VITE_API_URL = base.VITE_API_URL;
    merged.VITE_APP_URL = base.VITE_APP_URL;
    merged.VITE_APP_NAME = base.VITE_APP_NAME;
    merged.VITE_APP_THEME = base.VITE_APP_THEME;
    merged.VITE_THEME = base.VITE_THEME;
  }

  if (includeEmpty) {
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === null) {
        merged[key] = '';
      }
    }
  }

  return merged;
}

export function generateEnv({
  config,
  platform,
  includeEmpty = false,
}: {
  config: ReturnType<typeof parseBuildConfig>;
  platform: SupportedPlatform;
  includeEmpty?: boolean;
}): string {
  const map = buildEnvMap(config, platform, {includeEmpty});
  return Object.entries(map)
    .filter(([, value]) =>
      includeEmpty ? true : value !== undefined && value !== null
    )
    .map(([key, value]) => `${key}=${stringify((value ?? '') as Value)}`)
    .join('\n');
}

export function generateBuildConfig(
  args: GenerateBuildConfigArgs,
  cwd = process.cwd()
): string {
  if (args.help) {
    return `${HELP_TEXT}\n`;
  }

  const rawPlatform = String(
    args.platform ?? args.target ?? 'all'
  ).toLowerCase();
  const validPlatforms = new Set<SupportedPlatform>([
    'all',
    'android',
    'ios',
    'web',
  ]);

  if (!validPlatforms.has(rawPlatform as SupportedPlatform)) {
    throw new Error(
      `Unsupported platform: ${rawPlatform}. Expected one of ${[...validPlatforms].join(', ')}`
    );
  }

  const platform = rawPlatform as SupportedPlatform;

  if (!args.config) {
    throw new Error(
      'A config file path is required. Pass --config path/to/config.json'
    );
  }

  const parsed = parseBuildConfig(readConfigJson(String(args.config), cwd));
  const env = generateEnv({config: parsed, platform});

  if (args.out) {
    const outPath = path.resolve(cwd, String(args.out));
    fs.mkdirSync(path.dirname(outPath), {recursive: true});
    fs.writeFileSync(outPath, `${env}\n`, 'utf8');
    return `Generated build config at ${outPath}\n`;
  }

  return `${env}\n`;
}

export function main(
  argv: string[] = process.argv.slice(2),
  cwd = process.cwd()
) {
  try {
    const args = parseArgs(argv);
    const output = generateBuildConfig(args, cwd);
    process.stdout.write(output);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  process.exit(main());
}
