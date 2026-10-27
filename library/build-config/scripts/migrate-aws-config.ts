// SPDX-License-Identifier: Apache-2.0
/**
 * Migrate a legacy main-branch AWS CDK config (`uiConfiguration`, `smtp`,
 * …) to the new shared JSON config layout.
 *
 * Input : one legacy AWS config JSON file (the flat shape validated by the
 *         old `infrastructure/aws-cdk/lib/config.ts` `ConfigSchema` on
 *         `main`: `stackName`, `uiConfiguration`, `conductor`, `smtp`,
 *         `authProviders.config`, `aws: {account, region}`, ...), plus —
 *         unless `--no-aws` is given — an authenticated AWS environment.
 *         Referenced Secrets Manager secrets are pulled through the AWS
 *         CLI (`aws secretsmanager get-secret-value`), which uses whatever
 *         credentials/profile/region the caller's environment provides.
 *
 * Output (written to --out-dir):
 *   core.json          the shared, non-secret core config
 *                      (`@faims3/build-config` `BuildConfigSchema`). Every
 *                      co-located secret slot is left empty, EXCEPT the
 *                      publishable client keys that were already plaintext
 *                      in the legacy file and are baked into the front-end
 *                      bundle (map tile / autosuggest keys, Bugsnag key —
 *                      cf. `config/core.sample.json` in this package, which
 *                      also carries them). Those are mirrored into
 *                      secrets.json as well.
 *   secrets.json       the (for now unencrypted) secret overlay, in the
 *                      exact shape of `config/secrets.sample.json`: a
 *                      partial core that is deep-merged over core.json
 *                      (`jq -s '.[0] * .[1]' core.json secrets.json`, as the
 *                      mobile workflows do) before `parseBuildConfig`.
 *                      Encrypt it with SOPS to produce `secrets.enc.json`
 *                      (see scripts/sync-deployment-config.sh). Written
 *                      with mode 0600. Treat it like a password file.
 *   aws.json           the AWS-only extension (`AwsConfigSchema` in the new
 *                      `infrastructure/aws-cdk/lib/config.ts`): stack /
 *                      hosted zone / certificates / account+region /
 *                      signing-key + SMTP-credentials secret ARNs / couch
 *                      sizing / backup / TTL cleanup / Fargate conductor /
 *                      Route53 domains / enabled auth providers + secret
 *                      ARN. Secret *values* never land here, only ARNs.
 *                      Together core.json + aws.json are the env folder
 *                      every consumer loads (the CDK via `loadConfigFromEnv`
 *                      in `infrastructure/aws-cdk/lib/config.ts`:
 *                      `CONFIG_ENV=<env>` reads the sync script's local
 *                      mirror `config/<env>/`; `CONFIG_DIR=<dir>` reads
 *                      any env folder, e.g. a config-repo checkout).
 *   migration-report.md  what was mapped, what was fetched (by ARN and
 *                      field *name* only), what was dropped, and what a
 *                      human still needs to check. Contains no secret
 *                      values.
 *
 * Secret-handling rules (do not weaken these):
 *   - Secret values are held in memory only, written only to
 *     secrets.json (0600), and NEVER printed, logged, or put in the
 *     report. Error messages carry ARNs / field names, never payloads.
 *   - The signing-key secret (`secrets.privateKey`) is NOT exported: the
 *     API reads both keys from that one secret via KEY_SOURCE=AWS_SM, so
 *     only its ARN lands in aws.json and it is only `describe-secret`d to
 *     confirm it exists. The legacy separate `secrets.publicKey` ARN has
 *     no slot in the new model (the public key lives in the same secret's
 *     JSON) and is dropped, noted in the report.
 *   - The CouchDB admin and cookie secrets are created by the CDK itself
 *     (not referenced by the legacy file), so they are discovered via
 *     `list-secrets` name matching, or taken from
 *     --couch-secret-arn / --cookie-secret-arn when discovery is
 *     ambiguous. Failure to find them is a warning, not a silent default:
 *     if they are missing, secrets.json simply omits them and the merged
 *     config falls back to build-config's local-dev defaults — the
 *     report calls this out in red-flag language.
 *
 * Usage:
 *   pnpm --filter=@faims3/build-config run migrate-aws -- \
 *     --config path/to/legacy-dev.json --out-dir path/to/out \
 *     [--profile my-aws-profile] [--region ap-southeast-2] \
 *     [--couch-secret-arn arn:...] [--cookie-secret-arn arn:...] \
 *     [--no-aws] [--allow-missing-secrets] [--force]
 */

import {execFile, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseBuildConfig} from '../src/build-config.js';

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type ReportLevel = 'info' | 'warn' | 'error';

export interface ReportEntry {
  level: ReportLevel;
  area: string;
  message: string;
}

class Report {
  entries: ReportEntry[] = [];
  info(area: string, message: string) {
    this.entries.push({level: 'info', area, message});
  }
  warn(area: string, message: string) {
    this.entries.push({level: 'warn', area, message});
  }
  error(area: string, message: string) {
    this.entries.push({level: 'error', area, message});
  }
  get hasErrors(): boolean {
    return this.entries.some(e => e.level === 'error');
  }
}

// ---------------------------------------------------------------------------
// Small helpers (values passed here are NOT secrets unless documented)
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function rec(v: unknown): Rec {
  return isRec(v) ? v : {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function strArray(v: unknown): string[] | undefined {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : undefined;
}

/** Legacy provider `scope` is one string ("profile email" or "a,b"); new is string[]. */
export function splitScope(v: unknown): string[] {
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string');
  if (typeof v !== 'string') return [];
  return v.split(/[\s,]+/).filter(Boolean);
}

/** Legacy address-country is a CSV string; new is an upper-case string[]. */
export function splitCountryCsv(v: unknown): string[] | undefined {
  if (Array.isArray(v))
    return v
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  return v
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

function parseBoolLoose(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
  }
  return undefined;
}

function parseIntLoose(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : num(v);
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

function warnUnknown(
  report: Report,
  obj: Rec,
  allowed: readonly string[],
  at: string
) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      report.warn(
        'unmapped',
        `${at}.${key} has no equivalent in the new config and was dropped (value not copied, not logged).`
      );
    }
  }
}

/** Recursively drop undefined / empty-object branches. Arrays are kept as-is. */
function prune(value: unknown): unknown {
  if (!isRec(value)) return value;
  const out: Rec = {};
  for (const [k, v] of Object.entries(value)) {
    const p = prune(v);
    if (p === undefined) continue;
    if (isRec(p) && Object.keys(p).length === 0) continue;
    out[k] = p;
  }
  return out;
}

/** Deep merge with jq's `.[0] * .[1]` semantics (objects merge, rest wins). */
export function deepMerge(a: unknown, b: unknown): unknown {
  if (isRec(a) && isRec(b)) {
    const out: Rec = {...a};
    for (const [k, v] of Object.entries(b)) out[k] = deepMerge(a[k], v);
    return out;
  }
  return b === undefined ? a : b;
}

// ---------------------------------------------------------------------------
// Secrets Manager access
// ---------------------------------------------------------------------------

/**
 * Minimal secrets fetcher. Implementations must never log the returned
 * string. `listSecrets` returns metadata only (names/ARNs/descriptions —
 * a secret's name is not its value).
 */
export interface SecretFetcher {
  getSecretValue(secretId: string): Promise<string>;
  describeSecret(secretId: string): Promise<boolean>;
  listSecrets(): Promise<
    Array<{name: string; arn?: string; description?: string}>
  >;
}

/**
 * Fetcher backed by the AWS CLI, inheriting the caller's authenticated
 * environment (AWS_PROFILE / AWS_REGION / SSO / instance role / ...).
 * The CLI is invoked with execFile (no shell), so an ARN from the config
 * file can never be interpreted as shell syntax. Its stdout (which for
 * get-secret-value contains the secret) is captured in memory only and
 * never inherited by our own stdout/stderr.
 */
export class AwsCliSecretFetcher implements SecretFetcher {
  constructor(
    private readonly opts: {awsCli: string; region?: string; profile?: string}
  ) {}

  private async run(args: string[]): Promise<string> {
    const full = ['secretsmanager', ...args, '--output', 'json'];
    if (this.opts.region) full.push('--region', this.opts.region);
    if (this.opts.profile) full.push('--profile', this.opts.profile);
    return new Promise((resolve, reject) => {
      execFile(
        this.opts.awsCli,
        full,
        {maxBuffer: 16 * 1024 * 1024},
        (error, stdout) => {
          if (error) {
            // Deliberately discard stderr: it is not needed and we never
            // want a payload-adjacent string in an error message.
            reject(
              new Error(
                `aws CLI failed (${(error as NodeJS.ErrnoException).code ?? 'error'}) for: ${args[0]} ${args[1] ?? ''}`.trim()
              )
            );
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  async getSecretValue(secretId: string): Promise<string> {
    const raw = await this.run(['get-secret-value', '--secret-id', secretId]);
    const parsed = JSON.parse(raw) as {
      SecretString?: string;
      SecretBinary?: string;
    };
    if (typeof parsed.SecretString === 'string') return parsed.SecretString;
    if (typeof parsed.SecretBinary === 'string') {
      return Buffer.from(parsed.SecretBinary, 'base64').toString('utf8');
    }
    throw new Error('secret had neither SecretString nor SecretBinary');
  }

  async describeSecret(secretId: string): Promise<boolean> {
    try {
      await this.run(['describe-secret', '--secret-id', secretId]);
      return true;
    } catch {
      return false;
    }
  }

  async listSecrets(): Promise<
    Array<{name: string; arn?: string; description?: string}>
  > {
    const out: Array<{name: string; arn?: string; description?: string}> = [];
    let token: string | undefined;
    // Bounded pagination: 20 pages x 100 is far beyond any FAIMS account.
    for (let page = 0; page < 20; page++) {
      const args = ['list-secrets', '--max-results', '100'];
      if (token) args.push('--next-token', token);
      const parsed = JSON.parse(await this.run(args)) as {
        SecretList?: Array<{
          Name?: string;
          ARN?: string;
          Description?: string;
        }>;
        NextToken?: string;
      };
      for (const s of parsed.SecretList ?? []) {
        if (s.Name)
          out.push({name: s.Name, arn: s.ARN, description: s.Description});
      }
      token = parsed.NextToken;
      if (!token) break;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Migration core
// ---------------------------------------------------------------------------

export interface MigrateOptions {
  /** Explicit CouchDB admin secret ARN/name (skips discovery). */
  couchSecretArn?: string;
  /** Explicit cookie secret ARN/name (skips discovery). */
  cookieSecretArn?: string;
  /** Stack name hint used to disambiguate discovered secrets. */
  stackNameHint?: string;
}

export interface MigrateResult {
  core: Rec;
  secrets: Rec;
  aws: Rec;
  report: ReportEntry[];
}

const PROVIDER_SECRET_FIELDS = [
  'clientID',
  'clientSecret',
  'privateKey',
  'publicKey',
  'idpPublicKey',
] as const;

const SAML_NON_SECRET_FIELDS = [
  'callbackURL',
  'path',
  'authnRequestBinding',
  'skipRequestCompression',
  'signMetadata',
  'enableDecryptionPvk',
  'signatureAlgorithm',
  'digestAlgorithm',
  'wantAssertionsSigned',
  'identifierFormat',
  'authnContext',
  'disableRequestedAuthnContext',
  'forceAuthn',
  'acceptedClockSkewMs',
  'maxAssertionAgeMs',
  'validateInResponseTo',
  'requestIdExpirationPeriodMs',
  'logoutURL',
  'logoutCallbackURL',
  'idpIssuer',
  'audience',
  'metadataErrorURL',
  'ssoErrorPageTitle',
  'ssoErrorPageHeading',
  'ssoErrorPageLead',
  'ssoErrorPageDetailMarkdown',
  'ssoErrorPageReturnURL',
  'ssoErrorPageReturnLabel',
] as const;

/**
 * Migrate one parsed legacy config. `fetcher` may be null (offline /
 * --no-aws): every value that lives only in Secrets Manager is then left
 * out of secrets.json and reported as unresolved.
 *
 * This function never logs, and no report message ever contains a secret
 * value (only ARNs, provider ids, field names and config paths).
 */
export async function migrateOldAwsConfig(
  rawOld: unknown,
  fetcher: SecretFetcher | null,
  opts: MigrateOptions = {}
): Promise<MigrateResult> {
  const report = new Report();

  if (!isRec(rawOld)) {
    throw new Error('Legacy config must be a JSON object.');
  }
  if (isRec(rawOld.core) && isRec(rawOld.aws)) {
    throw new Error(
      'Input already looks like the new {core, aws} shape — nothing to migrate.'
    );
  }
  const old = rawOld;

  // -- The overlay that becomes secrets.json (partial-core shape). --------
  const secrets: Rec = {};
  const secretGroup = (name: string): Rec => {
    if (!isRec(secrets[name])) secrets[name] = {};
    return secrets[name] as Rec;
  };

  // =======================================================================
  // core
  // =======================================================================
  const core: Rec = {};
  const ui = rec(old.uiConfiguration);
  const offlineMaps = rec(ui.offlineMaps);
  const autosuggest = rec(ui.addressAutosuggest);
  const supportLinks = rec(old.supportLinks);
  const conductorOld = rec(old.conductor);
  const smtpOld = rec(old.smtp);
  const authProvOld = rec(old.authProviders);
  const securityOld = rec(old.security);
  const domainsOld = rec(old.domains);
  const mobileAppsOld = rec(old.mobileApps);

  // ---- endpoints + domains ---------------------------------------------
  // The CDK derives concrete URLs from aws.domains; the app/web/api builds
  // derive the same URLs from core.domains, so a disagreement is impossible
  // as long as both come from the one legacy `domains` block.
  if (isRec(old.domains)) {
    warnUnknown(
      report,
      domainsOld,
      ['baseDomain', 'conductor', 'couch', 'faims', 'web', 'docs'],
      'domains'
    );
    const services: Rec = {};
    if (str(domainsOld.conductor)) services.conductor = domainsOld.conductor;
    if (str(domainsOld.couch)) services.couch = domainsOld.couch;
    if (str(domainsOld.web)) services.web = domainsOld.web;
    // Legacy name for the mobile-app service is `faims`; the new domain
    // model calls it `app`.
    if (str(domainsOld.faims)) services.app = domainsOld.faims;
    if (str(domainsOld.docs)) services.docs = domainsOld.docs;
    if (str(domainsOld.baseDomain)) {
      core.domains = {base: domainsOld.baseDomain, protocol: 'https', services};
      report.info(
        'domains',
        'domains.baseDomain/services mapped to core.domains (legacy `faims` service renamed to `app`); concrete endpoints are derived from it. The same values are kept verbatim (with `faims`) in aws.domains for Route53.'
      );
    }
  } else {
    report.warn(
      'domains',
      'Legacy config has no `domains` block: core.domains/endpoints were not derived. Set them manually or generated builds will use localhost defaults.'
    );
  }
  const endpoints: Rec = {};
  if (str(mobileAppsOld.androidAppPublicUrl))
    endpoints.androidAppPublicUrl = mobileAppsOld.androidAppPublicUrl;
  if (str(mobileAppsOld.iosAppPublicUrl))
    endpoints.iosAppPublicUrl = mobileAppsOld.iosAppPublicUrl;
  if (Object.keys(endpoints).length) core.endpoints = endpoints;
  warnUnknown(
    report,
    mobileAppsOld,
    ['androidAppPublicUrl', 'iosAppPublicUrl'],
    'mobileApps'
  );

  // ---- branding ----------------------------------------------------------
  const themeRaw = str(ui.uiTheme);
  if (themeRaw === 'bubble') {
    report.warn(
      'branding',
      "uiTheme 'bubble' was retired in the new theme set; mapped to 'default'. Check the app/web theme choice."
    );
  }
  core.branding = prune({
    appName: str(ui.appName),
    headingAppName: str(ui.headingAppName),
    theme: themeRaw === 'bubble' ? 'default' : themeRaw,
    websiteTitle: str(rec(old.web).title),
    conductorInstanceName: str(conductorOld.name),
    conductorDescription: str(conductorOld.description),
    conductorShortCodePrefix: str(conductorOld.shortCodePrefix),
  });
  warnUnknown(report, rec(old.web), ['title'], 'web');
  if (isRec(old.docs) && Object.keys(rec(old.docs)).length) {
    report.warn(
      'docs',
      'Legacy `docs` block is not empty but the new config has no docs group; its keys were dropped.'
    );
  }

  // ---- support -----------------------------------------------------------
  core.support = prune({
    supportEmail: str(supportLinks.supportEmail),
    privacyPolicyUrl: str(supportLinks.privacyPolicyUrl),
    appContactUrl: str(supportLinks.contactUrl),
    docsUrl: str(supportLinks.docsUrl),
  });
  warnUnknown(
    report,
    supportLinks,
    ['supportEmail', 'privacyPolicyUrl', 'contactUrl', 'docsUrl'],
    'supportLinks'
  );

  // ---- notebook / record UX ---------------------------------------------
  core.notebookAndRecordUX = prune({
    notebookName: str(ui.notebookName),
    notebookListType: str(ui.notebookListType),
    showStatusTab: bool(ui.showStatusTab),
  });

  // ---- android -----------------------------------------------------------
  // Legacy appId served both platforms; the new model keeps it in
  // android.appId and lets ios.bundleIdentifier fall back to it.
  if (str(ui.appId)) core.android = {appId: ui.appId};

  warnUnknown(
    report,
    ui,
    [
      'uiTheme',
      'notebookListType',
      'notebookName',
      'appName',
      'appId',
      'headingAppName',
      'offlineMaps',
      'addressAutosuggest',
      'forceRemoteDeletion',
      'deleteOnDeactivation',
      'excludedTeamRoles',
      'enablePlansInDesigner',
      'showStatusTab',
    ],
    'uiConfiguration'
  );

  // ---- maps ---------------------------------------------------------------
  // Map tile / autosuggest keys are publishable client keys (they were
  // plaintext in the legacy file and are baked into the front-end bundle),
  // so they stay in core — matching config/core.sample.json — AND are
  // mirrored into secrets.json for the SOPS/mobile flow.
  const mapSourceKey = str(offlineMaps.mapSourceKey);
  const autosuggestSourceRaw = str(autosuggest.source);
  const autosuggestSource = autosuggestSourceRaw
    ? autosuggestSourceRaw.toLowerCase()
    : undefined;
  const mapboxKey = str(autosuggest.mapboxKey);
  const maptilerKey = str(autosuggest.maptilerKey);
  core.maps = prune({
    mapSource: str(offlineMaps.mapSource)
      ? (offlineMaps.mapSource as string).toLowerCase()
      : undefined,
    mapSourceKey,
    satelliteSource: str(offlineMaps.satelliteSource)
      ? (offlineMaps.satelliteSource as string).toLowerCase()
      : undefined,
    offlineMaps: bool(offlineMaps.offlineMaps),
    mapStyle: str(offlineMaps.mapStyle),
    autosuggestSource,
    autosuggestMapboxKey: mapboxKey,
    autosuggestMapTilerKey: maptilerKey,
    mapboxAddressCountry: splitCountryCsv(autosuggest.mapboxAddressCountry),
    maptilerAddressCountry: splitCountryCsv(autosuggest.maptilerAddressCountry),
  });
  warnUnknown(
    report,
    offlineMaps,
    ['mapSource', 'mapSourceKey', 'satelliteSource', 'offlineMaps', 'mapStyle'],
    'uiConfiguration.offlineMaps'
  );
  warnUnknown(
    report,
    autosuggest,
    [
      'source',
      'mapboxKey',
      'mapboxAddressCountry',
      'maptilerKey',
      'maptilerAddressCountry',
    ],
    'uiConfiguration.addressAutosuggest'
  );
  {
    const mapsSecrets: Rec = {};
    if (mapSourceKey) mapsSecrets.mapSourceKey = mapSourceKey;
    if (mapboxKey) mapsSecrets.autosuggestMapboxKey = mapboxKey;
    if (maptilerKey) mapsSecrets.autosuggestMapTilerKey = maptilerKey;
    if (Object.keys(mapsSecrets).length) {
      secrets.maps = mapsSecrets;
      report.info(
        'maps',
        'Map/autosuggest keys kept in core.maps (publishable client keys, as in the legacy file) and mirrored to secrets.json:maps.'
      );
    }
    if (autosuggestSource === 'mapbox' && !mapboxKey) {
      report.error(
        'maps',
        'addressAutosuggest.source is MAPBOX but no mapboxKey was in the legacy config; the migrated core will fail validation until one is supplied.'
      );
    }
  }

  // ---- sync / team policy / designer limits ------------------------------
  core.sync = prune({
    forceRemoteDeletion: str(ui.forceRemoteDeletion),
    deleteOnDeactivation: bool(ui.deleteOnDeactivation),
  });
  if (strArray(ui.excludedTeamRoles)?.length) {
    core.teamAndRolePolicy = {excludedTeamRoles: ui.excludedTeamRoles};
  }
  if (bool(ui.enablePlansInDesigner) !== undefined) {
    core.webDesignerLimits = {enablePlansInDesigner: ui.enablePlansInDesigner};
  }

  // ---- auth (non-provider) ----------------------------------------------
  const disableLocalLogin = bool(authProvOld.disableLocalLogin);
  core.auth = prune({
    profileName: 'default',
    keySource: str(rec(old.secrets).privateKey) ? 'AWS_SM' : undefined,
    awsSecretKeyArn: str(rec(old.secrets).privateKey),
    disableLocalLogin,
    provisionSsoUsersPolicy: str(conductorOld.provisionSSOUsersPolicy),
    // cookieSecret is a secret slot: intentionally empty in core.
  });
  report.info(
    'auth',
    "core.auth.profileName set to 'default' and keySource to 'AWS_SM' with the legacy private-key ARN, matching what the old CDK hard-coded into the Conductor environment. The signing keys themselves are not exported (see aws.secrets)."
  );

  // ---- migration ----------------------------------------------------------
  // Legacy semantics: the startup-migration lock was hard-enabled on AWS
  // unless explicitly disabled or migrate-on-startup was skipped. Preserve
  // that effective value, don't just copy `disableStartupMigrationLock`.
  const disableMigrate = bool(conductorOld.disableMigrateOnStartup) ?? false;
  const lockEnabled =
    !disableMigrate && conductorOld.disableStartupMigrationLock !== true;
  core.migration = prune({
    disableMigrateOnStartup: disableMigrate,
    startupMigrationLockEnabled: lockEnabled,
    startupMigrationLockTimeoutMs: num(
      conductorOld.startupMigrationLockTimeoutMs
    ),
  });

  // ---- auth tokens / limits ------------------------------------------------
  if (num(securityOld.maximumLongLivedTokenDurationDays) !== undefined) {
    core.authTokens = {
      maximumLongLivedDurationDays:
        securityOld.maximumLongLivedTokenDurationDays,
    };
  }
  core.limits = prune({
    rateLimiterEnabled: bool(securityOld.rateLimiterEnabled),
    // Renamed in the new model: authAttemptLimiterEnabled -> attemptLimiterEnabled.
    attemptLimiterEnabled: bool(securityOld.authAttemptLimiterEnabled),
    exportRateLimiterEnabled: bool(securityOld.exportRateLimiterEnabled),
    exportRateLimiterWindowMs: num(securityOld.exportRateLimiterWindowMs),
    exportRateLimiterPerWindow: num(securityOld.exportRateLimiterPerWindow),
  });
  warnUnknown(
    report,
    securityOld,
    [
      'maximumLongLivedTokenDurationDays',
      'rateLimiterEnabled',
      'authAttemptLimiterEnabled',
      'exportRateLimiterEnabled',
      'exportRateLimiterWindowMs',
      'exportRateLimiterPerWindow',
    ],
    'security'
  );

  // ---- email (non-secret half) ---------------------------------------------
  core.email = prune({
    emailServiceType: str(smtpOld.emailServiceType),
    emailFromAddress: str(smtpOld.fromEmail),
    emailFromName: str(smtpOld.fromName),
    emailReplyTo: str(smtpOld.replyTo),
    testEmailAddress: str(smtpOld.testEmailAddress),
    smtpCacheExpirySeconds: num(smtpOld.cacheExpirySeconds),
    // smtpHost/smtpPort/smtpSecure come from the SMTP credentials secret
    // below; smtpUser/smtpPassword are secret slots (secrets.json only).
  });
  warnUnknown(
    report,
    smtpOld,
    [
      'emailServiceType',
      'fromEmail',
      'fromName',
      'replyTo',
      'testEmailAddress',
      'cacheExpirySeconds',
      'credentialsSecretArn',
    ],
    'smtp'
  );

  // ---- observability ---------------------------------------------------------
  // Bugsnag is a publishable client key: stays in core (as in
  // core.sample.json) and is mirrored into secrets.json.
  const bugsnagKey = str(rec(old.bugMonitoring).bugsnagKey);
  if (bugsnagKey) {
    core.observability = {bugsnagApiKey: bugsnagKey};
    secretGroup('observability').bugsnagApiKey = bugsnagKey;
    report.info(
      'observability',
      'bugMonitoring.bugsnagKey kept in core.observability (client key) and mirrored to secrets.json:observability.'
    );
  }
  warnUnknown(report, rec(old.bugMonitoring), ['bugsnagKey'], 'bugMonitoring');

  // ---- auth providers (definitions; secrets stripped) -----------------------
  const providerConfigOld = rec(authProvOld.config);
  const coreProviders: Rec = {};
  const secretProviders: Rec = {};
  for (const [providerId, rawCfg] of Object.entries(providerConfigOld)) {
    const cfg = rec(rawCfg);
    const type = str(cfg.type);
    if (type !== 'google' && type !== 'oidc' && type !== 'saml') {
      report.error(
        'authProviders',
        `Provider '${providerId}' has unknown type '${type ?? ''}' and was not migrated; add it manually in the new provider format.`
      );
      continue;
    }
    const out: Rec = {
      id: providerId,
      type,
      displayName: str(cfg.displayName) ?? providerId,
      scope: splitScope(cfg.scope),
    };
    if (num(cfg.index) !== undefined) out.index = cfg.index;
    if (str(cfg.helperText)) out.helperText = cfg.helperText;
    if (Array.isArray(cfg.callbackMethods))
      out.callbackMethods = cfg.callbackMethods;

    // Secrets that happen to be inline in the legacy file move to the overlay.
    const sec: Rec = {};
    for (const field of PROVIDER_SECRET_FIELDS) {
      const v = str(cfg[field]);
      if (v) sec[field] = v;
    }
    if (type === 'oidc') {
      for (const f of [
        'issuer',
        'authorizationURL',
        'tokenURL',
        'userInfoURL',
      ] as const) {
        if (str(cfg[f])) out[f] = cfg[f];
        else
          report.error(
            'authProviders',
            `OIDC provider '${providerId}' is missing '${f}' in the legacy config.`
          );
      }
    }
    if (type === 'saml') {
      for (const f of ['entryPoint', 'issuer'] as const) {
        if (str(cfg[f])) out[f] = cfg[f];
        else
          report.error(
            'authProviders',
            `SAML provider '${providerId}' is missing '${f}' in the legacy config.`
          );
      }
      for (const f of SAML_NON_SECRET_FIELDS) {
        if (cfg[f] !== undefined) out[f] = cfg[f];
      }
      // idpPublicKey is the IdP's *public* certificate. Keep it in core when
      // present (the CDK leaves a core value in plain env). It is also a
      // secret slot: SOPS merges it, and the CDK wires
      // <provider>-idpPublicKey from SM when core omits it.
      if (str(cfg.idpPublicKey)) {
        out.idpPublicKey = cfg.idpPublicKey;
      }
    }
    const known = new Set<string>([
      'id',
      'type',
      'index',
      'displayName',
      'helperText',
      'scope',
      'callbackMethods',
      ...PROVIDER_SECRET_FIELDS,
      'issuer',
      'authorizationURL',
      'tokenURL',
      'userInfoURL',
      'entryPoint',
      ...SAML_NON_SECRET_FIELDS,
    ]);
    for (const key of Object.keys(cfg)) {
      if (!known.has(key)) {
        report.warn(
          'authProviders',
          `Provider '${providerId}': legacy key '${key}' has no new equivalent and was dropped (value not copied).`
        );
      }
    }
    // SAML privateKey/publicKey and google/oidc clientID/clientSecret are
    // delivered by Secrets Manager on AWS and must not sit in core.
    for (const field of [
      'clientID',
      'clientSecret',
      'privateKey',
      'publicKey',
    ] as const) {
      delete out[field];
    }
    coreProviders[providerId] = out;
    if (Object.keys(sec).length) secretProviders[providerId] = sec;
  }
  if (Object.keys(coreProviders).length) core.authProviders = coreProviders;
  if (Object.keys(secretProviders).length) {
    // Overlay shape is the partial core itself (cf. secrets.sample.json):
    // provider credentials live at top-level `authProviders.<id>`, NOT
    // under `auth.` (core.auth is strict and would reject them on merge).
    secrets.authProviders = secretProviders;
    report.info(
      'authProviders',
      'Inline provider credentials found in the legacy file were moved out of core into secrets.json:authProviders.'
    );
  }
  warnUnknown(
    report,
    authProvOld,
    ['disableLocalLogin', 'providers', 'secretArn', 'config'],
    'authProviders'
  );
  warnUnknown(
    report,
    conductorOld,
    [
      'name',
      'description',
      'conductorDockerImage',
      'conductorDockerImageTag',
      'shortCodePrefix',
      'provisionSSOUsersPolicy',
      'cpu',
      'memory',
      'autoScaling',
      'localhostWhitelist',
      'disableMigrateOnStartup',
      'disableStartupMigrationLock',
      'startupMigrationLockTimeoutMs',
      'enhancedObservability',
    ],
    'conductor'
  );

  // Empty dedicated-secrets placeholder, mirroring the new sample CDK
  // core: the slots exist, the committed core carries no values.
  core.secrets = {auth: {authProviders: {}}};

  // =======================================================================
  // aws
  // =======================================================================
  const awsOld = rec(old.aws);
  const signingOld = rec(old.secrets);
  const aws: Rec = prune({
    stackName: str(old.stackName),
    hostedZone: prune({
      id: str(rec(old.hostedZone).id),
      name: str(rec(old.hostedZone).name),
    }),
    certificates: prune({
      primary: str(rec(old.certificates).primary),
      cloudfront: str(rec(old.certificates).cloudfront),
    }),
    account: str(awsOld.account),
    region: str(awsOld.region),
    secrets: prune({
      privateKey: str(signingOld.privateKey),
      // Legacy secrets.publicKey is intentionally dropped: the new model
      // has no slot for it — the API reads rsa_public_key from the
      // privateKey secret's JSON (KEY_SOURCE=AWS_SM). Reported below.
    }),
    smtpCredentialsSecretArn: str(smtpOld.credentialsSecretArn),
    couch: isRec(old.couch) ? old.couch : undefined,
    backup: isRec(old.backup) ? old.backup : undefined,
    ttlCleanup: isRec(old.ttlCleanup) ? old.ttlCleanup : undefined,
    conductor: prune({
      conductorDockerImage: str(conductorOld.conductorDockerImage),
      conductorDockerImageTag: str(conductorOld.conductorDockerImageTag),
      cpu: num(conductorOld.cpu),
      memory: num(conductorOld.memory),
      autoScaling: isRec(conductorOld.autoScaling)
        ? conductorOld.autoScaling
        : undefined,
      localhostWhitelist: bool(conductorOld.localhostWhitelist),
      enhancedObservability: bool(conductorOld.enhancedObservability),
    }),
    // Route53 subdomain prefixes are kept verbatim (`faims`, not `app`).
    domains: isRec(old.domains) ? old.domains : undefined,
    authProviders:
      str(authProvOld.secretArn) || strArray(authProvOld.providers)?.length
        ? prune({
            providers: strArray(authProvOld.providers) ?? [],
            secretArn: str(authProvOld.secretArn),
          })
        : undefined,
  }) as Rec;
  warnUnknown(report, awsOld, ['account', 'region'], 'aws');
  warnUnknown(report, signingOld, ['privateKey', 'publicKey'], 'secrets');
  if (str(signingOld.publicKey)) {
    report.info(
      'signing-keys',
      "Legacy secrets.publicKey ARN dropped: the new aws.secrets has only privateKey; the API reads rsa_public_key from that secret's JSON. The old public-key secret can be retired once nothing else references it."
    );
  }
  warnUnknown(
    report,
    old,
    [
      'stackName',
      'hostedZone',
      'certificates',
      'aws',
      'secrets',
      'uiConfiguration',
      'supportLinks',
      'couch',
      'backup',
      'ttlCleanup',
      'conductor',
      'domains',
      'mobileApps',
      'web',
      'docs',
      'smtp',
      'authProviders',
      'security',
      'bugMonitoring',
    ],
    '(top level)'
  );

  // Structural checks on the aws slot (the CDK's AwsConfigSchema is not
  // importable here without dragging in aws-cdk-lib; these mirror its
  // required fields).
  for (const [label, v] of [
    ['aws.stackName', aws.stackName],
    ['aws.hostedZone.id', rec(aws.hostedZone).id],
    ['aws.hostedZone.name', rec(aws.hostedZone).name],
    ['aws.certificates.primary', rec(aws.certificates).primary],
    ['aws.certificates.cloudfront', rec(aws.certificates).cloudfront],
    ['aws.account', aws.account],
    ['aws.secrets.privateKey', rec(aws.secrets).privateKey],
    ['aws.smtpCredentialsSecretArn', aws.smtpCredentialsSecretArn],
    ['aws.couch.volumeSize', rec(aws.couch).volumeSize],
    ['aws.couch.instanceType', rec(aws.couch).instanceType],
    [
      'aws.conductor.conductorDockerImage',
      rec(aws.conductor).conductorDockerImage,
    ],
    ['aws.domains.baseDomain', rec(aws.domains).baseDomain],
  ] as Array<[string, unknown]>) {
    if (v === undefined || v === '') {
      report.error(
        'aws',
        `${label} is required by the new AwsConfigSchema but was missing/empty in the legacy config.`
      );
    }
  }
  {
    const backup = rec(aws.backup);
    if (Boolean(backup.vaultName) === Boolean(backup.vaultArn)) {
      report.error(
        'aws',
        'aws.backup must set exactly one of vaultName / vaultArn (legacy value copied verbatim — fix manually).'
      );
    }
  }

  // =======================================================================
  // Secrets Manager fetches (values in memory only; never reported)
  // =======================================================================
  const fetchJsonSecret = async (
    secretId: string,
    area: string
  ): Promise<Rec | string | null> => {
    if (!fetcher) {
      report.warn(
        area,
        `Not fetched (offline / --no-aws): ${secretId}. Its values are missing from secrets.json; the ARN is preserved in aws.json so AWS deploys still resolve it from Secrets Manager.`
      );
      return null;
    }
    try {
      const raw = await fetcher.getSecretValue(secretId);
      report.info(
        area,
        `Fetched secret ${secretId} (field names only are recorded below; values are only in secrets.json).`
      );
      try {
        const parsed: unknown = JSON.parse(raw);
        return isRec(parsed) ? parsed : raw;
      } catch {
        return raw;
      }
    } catch {
      report.error(
        area,
        `Failed to fetch secret ${secretId} (AWS CLI error; no payload logged). Re-run with credentials that can read it, or use --allow-missing-secrets to write an incomplete secrets.json.`
      );
      return null;
    }
  };

  // ---- SMTP credentials: {host, port, secure, user, pass} ----------------
  const smtpArn = str(smtpOld.credentialsSecretArn);
  if (smtpArn) {
    const smtpSecret = await fetchJsonSecret(smtpArn, 'smtp-secret');
    if (isRec(smtpSecret)) {
      const emailCore = rec(core.email);
      if (str(smtpSecret.host)) emailCore.smtpHost = smtpSecret.host;
      const port = parseIntLoose(smtpSecret.port);
      if (port !== undefined) emailCore.smtpPort = port;
      const secure = parseBoolLoose(smtpSecret.secure);
      if (secure !== undefined) emailCore.smtpSecure = secure;
      core.email = emailCore;
      const emailSecrets: Rec = {};
      if (str(smtpSecret.user)) emailSecrets.smtpUser = smtpSecret.user;
      if (str(smtpSecret.pass)) emailSecrets.smtpPassword = smtpSecret.pass;
      if (Object.keys(emailSecrets).length) secrets.email = emailSecrets;
      const known = ['host', 'port', 'secure', 'user', 'pass'];
      for (const k of Object.keys(smtpSecret)) {
        if (!known.includes(k))
          report.warn(
            'smtp-secret',
            `SMTP secret key '${k}' has no new equivalent and was not copied.`
          );
      }
      report.info(
        'smtp-secret',
        `SMTP secret fields present: ${Object.keys(smtpSecret).sort().join(', ') || '(none)'}. host/port/secure went to core.email; user/pass to secrets.json:email.`
      );
    } else if (typeof smtpSecret === 'string') {
      report.error(
        'smtp-secret',
        'SMTP credentials secret was not a JSON object ({host,port,secure,user,pass}); nothing was copied from it.'
      );
    }
  }

  // ---- Auth provider credentials: {"<id>-clientID": ..., ...} -------------
  const authArn = str(authProvOld.secretArn);
  const enabledProviders = strArray(authProvOld.providers) ?? [];
  if (authArn && enabledProviders.length) {
    const authSecret = await fetchJsonSecret(authArn, 'auth-secret');
    if (isRec(authSecret)) {
      const byProvider: Rec = isRec(secrets.authProviders)
        ? (secrets.authProviders as Rec)
        : {};
      const seenProviders = new Set<string>();
      for (const [key, value] of Object.entries(authSecret)) {
        // Keys are `<provider>-<field>`; provider ids may not contain '-'
        // in practice, so split on the last dash.
        const dash = key.lastIndexOf('-');
        const providerId = dash > 0 ? key.slice(0, dash) : '';
        const field = dash > 0 ? key.slice(dash + 1) : '';
        if (
          !providerId ||
          !(PROVIDER_SECRET_FIELDS as readonly string[]).includes(field)
        ) {
          report.warn(
            'auth-secret',
            `Auth secret key '${key}' did not match <provider>-<clientID|clientSecret|privateKey|publicKey|idpPublicKey> and was not copied.`
          );
          continue;
        }
        seenProviders.add(providerId);
        if (!isRec(byProvider[providerId])) byProvider[providerId] = {};
        if (str(value)) {
          const hadInline =
            str(rec(byProvider[providerId])[field]) !== undefined;
          (byProvider[providerId] as Rec)[field] = value;
          if (hadInline) {
            report.info(
              'auth-secret',
              `Provider '${providerId}' field '${field}' was present both inline and in Secrets Manager; the Secrets Manager value won.`
            );
          }
        }
      }
      if (Object.keys(byProvider).length) {
        secrets.authProviders = byProvider;
      }
      for (const p of enabledProviders) {
        if (!seenProviders.has(p)) {
          report.warn(
            'auth-secret',
            `Enabled provider '${p}' had no keys in the auth secret; check it needs no credentials or that the secret uses <provider>-<field> key names.`
          );
        }
        if (!(p in coreProviders)) {
          report.error(
            'authProviders',
            `Provider '${p}' is enabled in aws.authProviders.providers but has no definition in legacy authProviders.config, so it has no core.authProviders entry (the new CDK loadConfig rejects this).`
          );
        }
      }
      report.info(
        'auth-secret',
        `Auth secret fields fetched for provider(s): ${[...seenProviders].sort().join(', ') || '(none)'} — values are only in secrets.json:authProviders.`
      );
    } else if (typeof authSecret === 'string') {
      report.error(
        'auth-secret',
        'Auth providers secret was not a JSON object ({"<provider>-clientID": ...}); nothing was copied from it.'
      );
    }
  } else if (authArn) {
    report.info(
      'auth-secret',
      'Auth secret ARN present but no providers are enabled; the secret was not fetched.'
    );
  }

  // ---- CouchDB admin + cookie (CDK-generated; discover or explicit) -------
  const discover = async (
    explicit: string | undefined,
    // Match on the secret NAME only, never the description: the CDK's
    // cookie-secret description ("...cookie auth in conductor and couch")
    // contains the word "couch" and would otherwise be a false CouchDB
    // candidate (and vice versa).
    matchesName: (name: string) => boolean,
    label: string
  ): Promise<Rec | string | null> => {
    if (explicit) return fetchJsonSecret(explicit, label);
    if (!fetcher) {
      report.warn(
        label,
        `Not fetched (offline / --no-aws and no explicit ARN given). Pass --${label === 'couch-secret' ? 'couch' : 'cookie'}-secret-arn on a re-run to include it.`
      );
      return null;
    }
    try {
      const all = await fetcher.listSecrets();
      const candidates = all.filter(s => matchesName(s.name));
      const stackName = opts.stackNameHint ?? str(old.stackName) ?? '';
      const preferred = candidates.filter(
        c => stackName && c.name.includes(stackName)
      );
      const pool = preferred.length ? preferred : candidates;
      if (pool.length === 1) {
        report.info(
          label,
          `Discovered CDK-generated secret by name match: ${pool[0].name}.`
        );
        return fetchJsonSecret(pool[0].arn ?? pool[0].name, label);
      }
      if (pool.length > 1) {
        report.warn(
          label,
          `Discovery found ${pool.length} candidate secrets (${pool.map(c => c.name).join(', ')}); refusing to guess. Re-run with an explicit ARN.`
        );
        return null;
      }
      report.warn(
        label,
        'No CDK-generated secret matched discovery; it will be omitted from secrets.json. Re-run with an explicit ARN if this deployment already exists.'
      );
      return null;
    } catch {
      report.error(
        label,
        'Secret discovery (list-secrets) failed; re-run with an explicit ARN.'
      );
      return null;
    }
  };

  const couchSecret = await discover(
    opts.couchSecretArn,
    // CDK-generated name is "...CouchDBAdminPassword..."; a cookie secret
    // name must never count as a CouchDB candidate.
    name => /couch/i.test(name) && !/cookie/i.test(name),
    'couch-secret'
  );
  if (isRec(couchSecret)) {
    const couchCore: Rec = isRec(core.couchdb) ? (core.couchdb as Rec) : {};
    if (str(couchSecret.username)) couchCore.user = couchSecret.username;
    if (Object.keys(couchCore).length) core.couchdb = couchCore;
    if (str(couchSecret.password)) {
      secretGroup('couchdb').password = couchSecret.password;
      report.info(
        'couch-secret',
        'CouchDB admin username went to core.couchdb, password to secrets.json:couchdb.'
      );
    } else {
      report.warn(
        'couch-secret',
        "CouchDB admin secret had no 'password' key; secrets.json:couchdb is empty."
      );
    }
  } else if (typeof couchSecret === 'string') {
    report.warn(
      'couch-secret',
      'CouchDB admin secret was not a JSON {username,password} object; nothing was copied from it.'
    );
  }

  const cookieSecret = await discover(
    opts.cookieSecretArn,
    name => /cookie/i.test(name),
    'cookie-secret'
  );
  if (typeof cookieSecret === 'string' && cookieSecret.trim() !== '') {
    secretGroup('auth').cookieSecret = cookieSecret;
    report.info(
      'cookie-secret',
      'Cookie secret went to secrets.json:auth.cookieSecret.'
    );
  } else if (isRec(cookieSecret)) {
    report.warn(
      'cookie-secret',
      'Cookie secret was a JSON object, expected a plain string; nothing was copied from it.'
    );
  }
  if (!str(secretGroup('auth').cookieSecret)) {
    report.warn(
      'cookie-secret',
      'No cookie secret in secrets.json: a merged (non-AWS) config will generate/need one at runtime. On AWS the CDK still generates it, so this only matters off-AWS.'
    );
  }
  if (!str(secretGroup('couchdb').password)) {
    report.warn(
      'couch-secret',
      'No CouchDB password in secrets.json: DO NOT deploy a merged config like this — it would fall back to the build-config local-dev password. On AWS the CDK-generated secret still wins.'
    );
  }

  // ---- Signing key: verify existence only; never export the value --------
  {
    const arn = str(signingOld.privateKey);
    if (arn) {
      if (!fetcher) {
        report.info(
          'signing-keys',
          `Signing privateKey secret ${arn} kept as an ARN in aws.secrets (not checked, offline).`
        );
      } else {
        const exists = await fetcher.describeSecret(arn);
        report[exists ? 'info' : 'error'](
          'signing-keys',
          exists
            ? `Signing privateKey secret exists (${arn}); value intentionally NOT exported — the API reads it via KEY_SOURCE=AWS_SM.`
            : `Signing privateKey secret ${arn} could not be described; check the ARN / permissions.`
        );
      }
    }
  }

  // =======================================================================
  // Validation: core alone, and core+secrets merged, must both parse.
  // (Core alone must parse because the CDK validates the core slot on its
  // own; merged must parse because that is what app/web/api generate from.)
  // =======================================================================
  const prunedCore = prune(core) as Rec;
  // prune() drops the empty secrets placeholder; restore it to mirror the
  // sample shape (empty slots, no values).
  if (!isRec(prunedCore.secrets))
    prunedCore.secrets = {auth: {authProviders: {}}};
  const prunedSecrets = prune(secrets) as Rec;

  const validate = (label: string, value: unknown) => {
    try {
      parseBuildConfig(value);
      report.info(
        'validate',
        `${label} parses against @faims3/build-config BuildConfigSchema.`
      );
    } catch (e) {
      const issues =
        (e as {issues?: Array<{path: Array<string | number>; message: string}>})
          .issues ?? [];
      if (issues.length) {
        for (const issue of issues.slice(0, 20)) {
          report.error(
            'validate',
            `${label}: ${issue.path.join('.') || '(root)'}: ${issue.message}`
          );
        }
      } else {
        report.error(
          'validate',
          `${label}: failed to parse (${e instanceof Error ? e.message : 'unknown error'}).`
        );
      }
    }
  };
  validate('core.json', prunedCore);
  validate(
    'core.json + secrets.json (deep-merged)',
    deepMerge(prunedCore, prunedSecrets)
  );

  return {
    core: prunedCore,
    secrets: prunedSecrets,
    aws,
    report: report.entries,
  };
}

// ---------------------------------------------------------------------------
// Report rendering (no secret values — entries never contain any)
// ---------------------------------------------------------------------------

export function renderReport(
  result: MigrateResult,
  sourceName: string
): string {
  const lines: string[] = [
    '# AWS config migration report',
    '',
    `Source legacy config: \`${sourceName}\``,
    '',
    'Outputs: `core.json` (non-secret), `secrets.json` (UNENCRYPTED secrets —',
    'encrypt with SOPS before committing anywhere), `aws.json` (AWS-only',
    'extension, ARNs only). core.json + aws.json form the env folder every',
    'consumer loads.',
    '',
    'This report contains no secret values (only ARNs, provider ids, field',
    'names and config paths).',
    '',
  ];
  for (const level of ['error', 'warn', 'info'] as const) {
    const entries = result.report.filter(e => e.level === level);
    if (!entries.length) continue;
    lines.push(
      `## ${level === 'info' ? 'Notes' : level === 'warn' ? 'Warnings — check these' : 'Errors — must fix'}`,
      ''
    );
    for (const e of entries) lines.push(`- [${e.area}] ${e.message}`);
    lines.push('');
  }
  lines.push(
    '## Manual follow-ups',
    '',
    '- Review every warning above; dropped legacy keys are listed by path.',
    '- Encrypt `secrets.json` (`sops --encrypt`) into `secrets.enc.json` and',
    '  delete the plaintext copy; never commit it.',
    '- Validate the CDK files: this output dir is already an env folder —',
    '  `CONFIG_DIR=<this dir> pnpm --filter=@faims3/infra-aws-cdk run validate-config`',
    '  (or place core.json + aws.json into `config/<env>/` and use CONFIG_ENV).',
    '- Sanity-check generated env from the merged config:',
    "  `jq -s '.[0] * .[1]' core.json secrets.json | pnpm --filter=@faims3/build-config run generate -- --config - --platform all`",
    ''
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliArgs {
  help?: boolean;
  config?: string;
  outDir?: string;
  profile?: string;
  region?: string;
  awsCli?: string;
  couchSecretArn?: string;
  cookieSecretArn?: string;
  noAws?: boolean;
  allowMissingSecrets?: boolean;
  force?: boolean;
}

const HELP = `Usage: pnpm --filter=@faims3/build-config run migrate-aws -- --config <legacy-aws-config.json> --out-dir <dir> [options]

Migrates a legacy (main-branch) AWS CDK config JSON to core.json +
secrets.json (unencrypted) + aws.json.

Options:
  --config <path>            Legacy AWS config JSON (required)
  --out-dir <path>           Output directory (required; must be empty/new unless --force)
  --profile <name>           AWS CLI profile (default: caller's AWS_PROFILE / default)
  --region <name>            AWS region (default: legacy config's aws.region)
  --aws-cli <path>           aws CLI binary (default: "aws" on PATH)
  --couch-secret-arn <arn>   CouchDB admin secret (default: discover the CDK-generated one)
  --cookie-secret-arn <arn>  Cookie secret (default: discover the CDK-generated one)
  --no-aws                   Do not call AWS; SM-only secrets are reported as unresolved
  --allow-missing-secrets    Write outputs even if a referenced secret could not be fetched
  --force                    Overwrite existing output files
  -h, --help                 Show this help

Credentials are never read by this script directly: the AWS CLI subprocess
inherits your authenticated environment. Secret values are written only to
secrets.json (mode 0600) and are never printed.
`;

export function parseCliArgs(argv: string[]): CliArgs {
  const args: Rec = {};
  const flagKeys: Record<string, string> = {
    'out-dir': 'outDir',
    'aws-cli': 'awsCli',
    'couch-secret-arn': 'couchSecretArn',
    'cookie-secret-arn': 'cookieSecretArn',
    'no-aws': 'noAws',
    'allow-missing-secrets': 'allowMissingSecrets',
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const mapped = flagKeys[key] ?? key;
    if (
      mapped === 'noAws' ||
      mapped === 'allowMissingSecrets' ||
      key === 'force'
    ) {
      args[
        mapped === 'noAws' || mapped === 'allowMissingSecrets'
          ? mapped
          : 'force'
      ] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[mapped] = next;
      i++;
    } else {
      args[mapped] = true;
    }
  }
  return args as CliArgs;
}

/**
 * True if `git check-ignore` says the path is ignored. Returns true when
 * git is unavailable or the path is not in a worktree at all (nothing can
 * be committed from there, so there is nothing to warn about).
 */
export function isGitIgnored(filePath: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', filePath], {
      stdio: 'ignore',
    });
    return true;
  } catch (e) {
    // Exit 1 = not ignored (warn); anything else (not a repo, no git) = safe.
    return (e as {status?: number}).status !== 1;
  }
}

export async function main(
  argv: string[] = process.argv.slice(2)
): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.config || typeof args.config !== 'string') {
    process.stderr.write(
      'Missing --config <legacy-aws-config.json>\n\n' + HELP
    );
    return 1;
  }
  if (!args.outDir || typeof args.outDir !== 'string') {
    process.stderr.write('Missing --out-dir <dir>\n\n' + HELP);
    return 1;
  }

  // Resolve user paths against the directory the command was invoked from,
  // not the process cwd: `pnpm --filter=... run migrate-aws` executes with
  // cwd inside library/build-config, but callers pass repo-root-relative
  // paths. pnpm/npm set INIT_CWD to the invocation directory.
  const invocationDir = process.env.INIT_CWD ?? process.cwd();
  const configPath = path.resolve(invocationDir, args.config);
  let oldRaw: unknown;
  try {
    oldRaw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    process.stderr.write(
      `Could not read/parse legacy config: ${e instanceof Error ? e.message : String(e)}\n`
    );
    return 1;
  }

  const region =
    (typeof args.region === 'string' ? args.region : undefined) ??
    str(rec(rec(oldRaw).aws).region) ??
    process.env.AWS_REGION ??
    process.env.AWS_DEFAULT_REGION;

  const fetcher: SecretFetcher | null = args.noAws
    ? null
    : new AwsCliSecretFetcher({
        awsCli: typeof args.awsCli === 'string' ? args.awsCli : 'aws',
        region,
        profile: typeof args.profile === 'string' ? args.profile : undefined,
      });

  let result: MigrateResult;
  try {
    result = await migrateOldAwsConfig(oldRaw, fetcher, {
      couchSecretArn: args.couchSecretArn,
      cookieSecretArn: args.cookieSecretArn,
      stackNameHint: str(rec(oldRaw).stackName),
    });
  } catch (e) {
    process.stderr.write(
      `Migration failed: ${e instanceof Error ? e.message : String(e)}\n`
    );
    return 1;
  }

  const fetchErrors = result.report.filter(
    e =>
      e.level === 'error' &&
      (e.area.endsWith('-secret') || e.area === 'signing-keys')
  );
  if (fetchErrors.length && !args.allowMissingSecrets) {
    process.stderr.write(
      'Aborting before writing files: one or more referenced secrets could not be fetched. ' +
        'Fix credentials/permissions or pass --allow-missing-secrets to write an incomplete migration.\n'
    );
    for (const e of fetchErrors)
      process.stderr.write(`- [${e.area}] ${e.message}\n`);
    return 1;
  }

  const outDir = path.resolve(invocationDir, args.outDir);
  const files: Array<{name: string; contents: string; mode: number}> = [
    {
      name: 'core.json',
      contents: JSON.stringify(result.core, null, 2) + '\n',
      mode: 0o644,
    },
    {
      name: 'secrets.json',
      contents: JSON.stringify(result.secrets, null, 2) + '\n',
      mode: 0o600,
    },
    {
      name: 'aws.json',
      contents: JSON.stringify(result.aws, null, 2) + '\n',
      mode: 0o644,
    },
    {
      name: 'migration-report.md',
      contents: renderReport(result, path.basename(configPath)),
      mode: 0o644,
    },
  ];

  if (!args.force) {
    const existing = files.filter(f =>
      fs.existsSync(path.join(outDir, f.name))
    );
    if (existing.length) {
      process.stderr.write(
        `Refusing to overwrite existing file(s) in ${outDir}: ${existing.map(f => f.name).join(', ')} (pass --force to overwrite).\n`
      );
      return 1;
    }
  }

  fs.mkdirSync(outDir, {recursive: true});
  for (const f of files) {
    const target = path.join(outDir, f.name);
    fs.writeFileSync(target, f.contents, {mode: f.mode});
    // writeFileSync's mode only applies to newly created files.
    fs.chmodSync(target, f.mode);
  }

  const warnings = result.report.filter(e => e.level === 'warn').length;
  const errors = result.report.filter(e => e.level === 'error').length;
  process.stdout.write(
    `Wrote core.json, secrets.json (0600, UNENCRYPTED — encrypt before sharing/committing), aws.json and migration-report.md to ${outDir}\n` +
      `Report: ${errors} error(s), ${warnings} warning(s) — read migration-report.md before deploying.\n`
  );
  // Defence in depth: the FAIMS3 repo .gitignore covers these filenames,
  // but an --out-dir in another worktree may not. `git check-ignore` exits
  // 0 = ignored, 1 = not ignored, 128 = not a git worktree (nothing to
  // warn about — the file is outside version control entirely).
  if (!isGitIgnored(path.join(outDir, 'secrets.json'))) {
    process.stderr.write(
      `WARNING: ${path.join(outDir, 'secrets.json')} is inside a git worktree but is NOT gitignored. ` +
        "It contains plaintext secrets — add it to that repo's .gitignore (or move/delete it) before running git add/commit.\n"
    );
  }
  return errors > 0 ? 2 : 0;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().then(
    code => process.exit(code),
    () => process.exit(1)
  );
}
