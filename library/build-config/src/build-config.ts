import {z} from 'zod';
import {
  AuthProviderConfigMap,
  AuthProviderConfigMapSchema,
} from './auth-provider-config.js';
export {
  AuthProviderSchema,
  AuthProviderConfigMapSchema,
  readAuthProviderConfigFromEnv,
  buildAuthProviderEnvMap,
} from './auth-provider-config.js';
import {readAuthProviderConfigFromEnv} from './auth-provider-config.js';
export {
  BoolEnvSchema,
  PositiveIntStringSchema,
  OptionalCsvSchema,
  UpperCsvSchema,
  parseMaxLongLivedDays,
  sanitizeCommitVersion,
  parseBugsnagKey,
  NO_MAXIMUM_WORDS,
} from './env-coercion.js';
import {
  BoolEnvSchema,
  PositiveIntStringSchema,
  OptionalCsvSchema,
  UpperCsvSchema,
  parseMaxLongLivedDays,
  sanitizeCommitVersion,
  parseBugsnagKey,
  stripTrailingSlash,
} from './env-coercion.js';

const EndpointsBuildConfigSchema = z
  .object({
    webUrl: z.string().default('http://localhost:3001'),
    apiUrl: z.string().default('http://localhost:8080'),
    appUrl: z.string().default('http://localhost:3000'),
    /**
     * One or more Conductor URLs the mobile app can authenticate against
     * (CSV in the generated env; each entry becomes a login option).
     * Always non-empty: the shared invariant falls back to `apiUrl`.
     */
    conductorUrls: z.array(z.string()).default([]),
    couchdbInternalUrl: z.string().default('http://localhost:5984'),
    couchdbPublicUrl: z.string().default('http://localhost:5984'),
    androidAppPublicUrl: z.string().default(''),
    iosAppPublicUrl: z.string().default(''),
    redirectWhitelist: z.array(z.string()).optional(),
  })
  .strict();

const BrandingBuildConfigSchema = z
  .object({
    appName: z.string().default('FAIMS'),
    appShortName: z.string().optional(),
    headingAppName: z.string().optional(),
    theme: z.string().default('default'),
    websiteTitle: z.string().default('Control Centre'),
    conductorInstanceName: z
      .string()
      .default('Development FAIMS Server'),
    conductorDescription: z
      .string()
      .default('FAIMS Conductor Server'),
    conductorShortCodePrefix: z.string().default('FAIMS'),
  })
  .strict();

const SupportBuildConfigSchema = z
  .object({
    supportEmail: z.string().default('support@fieldmark.au'),
    privacyPolicyUrl: z
      .string()
      .default('https://fieldnote.au/privacy'),
    appContactUrl: z.string().default(''),
    docsUrl: z.string().default(''),
  })
  .strict();

const NotebookAndRecordUxBuildConfigSchema = z
  .object({
    notebookName: z.string().default('project'),
    notebookListType: z.enum(['tabs', 'headings']).default('tabs'),
    navigation: z.enum(['none', 'breadcrumbs']).default('none'),
    showRecordLinks: z.boolean().default(false),
    showStatusTab: z.boolean().default(true),
    showNewNotebook: z.boolean().default(true),
  })
  .strict();

const MapsBuildConfigSchema = z
  .object({
    mapSource: z.enum(['osm', 'maptiler', '']).default('osm'),
    mapSourceKey: z.string().default(''),
    satelliteSource: z.enum(['esri', 'maptiler']).optional(),
    mapStyle: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic'),
    offlineMaps: z.boolean().default(true),
    autosuggestSource: z
      .enum(['NONE', 'MAPBOX', 'MAPTILER'])
      .default('NONE'),
    autosuggestMapboxKey: z.string().default(''),
    autosuggestMapTilerKey: z.string().default(''),
    /** ISO 3166-1 alpha-2 codes (CSV in env). Defaults to Australia. */
    mapboxAddressCountry: z.array(z.string()).default(['AU']),
    /** ISO 3166-1 alpha-2 codes (CSV in env). Defaults to Australia. */
    maptilerAddressCountry: z.array(z.string()).default(['AU']),
  })
  .strict();

const SyncBuildConfigSchema = z
  .object({
    syncPushOnlyRecordThreshold: z.number().int().positive().default(500),
    forceRemoteDeletion: z.enum(['allow', 'never']).default('never'),
    deleteOnDeactivation: z.boolean().default(false),
  })
  .strict();

const AttachmentsBuildConfigSchema = z
  .object({
    attachmentServiceType: z.string().default('COUCH'),
    attachmentDocumentIdPrefix: z.string().optional(),
  })
  .strict();

const MigrationBuildConfigSchema = z
  .object({
    migrateOldDatabases: z.boolean().default(false),
    disableMigrateOnStartup: z.boolean().default(false),
    startupMigrationLockEnabled: z.boolean().default(false),
    startupMigrationLockTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(1800000),
  })
  .strict();

const AuthBuildConfigSchema = z
  .object({
    clusterAdminGroupName: z.string().default('cluster-admin'),
    directoryUsername: z.string().optional(),
    directoryPassword: z.string().optional(),
    profileName: z.string().default('local-dev'),
    keyFilePath: z.string().default('.'),
    keySource: z.enum(['FILE', 'ENV', 'AWS_SM']).default('FILE'),
    awsSecretKeyArn: z.string().optional(),
    cookieSecret: z.string().default(''),
    disableLocalLogin: z.boolean().default(false),
    provisionSsoUsersPolicy: z
      .enum(['own-team', 'general-user', 'reject'])
      .default('reject'),
  })
  .strict();

const AuthTokensBuildConfigSchema = z
  .object({
    tokenRefreshIntervalMs: z.number().int().positive().default(15000),
    tokenRefreshWindowMs: z.number().int().positive().default(60000),
    loginBannerGraceMs: z.number().int().positive().default(10000),
    ignoreTokenExp: z.boolean().default(false),
    longLivedTokenDurationHints: z.array(z.number().int().positive()).optional(),
    refreshTokenExpiryMinutes: z.number().int().positive().default(2880),
    accessTokenExpiryMinutes: z.number().int().positive().default(5),
    impersonationSessionExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(60),
    emailCodeExpiryMinutes: z.number().int().positive().default(30),
    maximumLongLivedDurationDays: z
      .union([z.number().int().positive(), z.literal('unlimited')])
      .default(90),
  })
  .strict();

const LimitsBuildConfigSchema = z
  .object({
    rateLimiterEnabled: z.boolean().default(true),
    rateLimiterWindowMs: z.number().int().positive().default(600000),
    rateLimiterPerWindow: z.number().int().positive().default(1000),
    exportRateLimiterEnabled: z.boolean().default(true),
    exportRateLimiterWindowMs: z.number().int().positive().default(600000),
    exportRateLimiterPerWindow: z.number().int().positive().default(20),
    attemptLimiterEnabled: z.boolean().default(true),
    jsonBodyLimit: z.string().default('25mb'),
    urlencodedBodyLimit: z.string().default('1mb'),
    restoreUploadMaxBytes: z.number().int().positive().default(1073741824),
    downloadCookieSameSite: z.enum(['lax', 'strict', 'none']).default('lax'),
    recordsHydratedPageLimit: z.number().int().positive().default(150),
  })
  .strict();

const EmailBuildConfigSchema = z
  .object({
    emailServiceType: z.enum(['SMTP', 'MOCK']).default('MOCK'),
    emailFromAddress: z.string().default('notifications@example.com'),
    emailFromName: z.string().default('FAIMS Notification'),
    emailReplyTo: z.string().default('support@example.com'),
    smtpHost: z.string().default('smtp.example.com'),
    smtpPort: z.number().int().positive().default(587),
    smtpSecure: z.boolean().default(true),
    smtpUser: z.string().default('smtp_username'),
    smtpPassword: z.string().default('smtp_password'),
    smtpCacheExpirySeconds: z.number().int().positive().default(300),
    testEmailAddress: z.string().default('test@gmail.com'),
  })
  .strict();

const ObservabilityBuildConfigSchema = z
  .object({
    /**
     * Sanitised commit hash / release stamp. `undefined` means "no valid
     * commit" (blank, placeholder or garbage). The generator resolves the
     * `git rev-parse HEAD` placeholder at emit time.
     */
    commitVersion: z.string().optional(),
    bugsnagApiKey: z.string().optional(),
  })
  .strict();

const TeamAndRolePolicyBuildConfigSchema = z
  .object({
    excludedTeamRoles: z.array(z.string()).default([]),
  })
  .strict();

const WebDesignerLimitsBuildConfigSchema = z
  .object({
    maxDesignFileSizeMb: z.number().int().positive().default(10),
    /** Enables template edit protections in the designer. */
    templateProtections: z.boolean().default(false),
    /**
     * Enables adding a plan in the designer for templates that do not already
     * have one. When false, existing plans can still be reconfigured.
     */
    enablePlansInDesigner: z.boolean().default(true),
  })
  .strict();

const AndroidBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3'),
    releaseStatus: z.string().default('draft'),
    keystoreFileBase64: z.string().optional(),
    serviceAccountKeyJsonBase64: z.string().optional(),
    keystorePath: z.string().optional(),
    keystorePassword: z.string().optional(),
    keyAlias: z.string().optional(),
    keyPassword: z.string().optional(),
    serviceAccountJsonPath: z.string().optional(),
  })
  .strict();

const IosBuildConfigSchema = z
  .object({
    bundleIdentifier: z.string().default('org.fedarch.faims3'),
    developerPortalTeamId: z.string().optional(),
    appStoreConnectTeamId: z.string().optional(),
    appleId: z.string().optional(),
    appleApplicationSpecificPassword: z.string().optional(),
    matchPassword: z.string().optional(),
    matchGitUrl: z.string().optional(),
    gitAuthorization: z.string().optional(),
    provisioningProfileSpecifier: z.string().optional(),
    appleKeyId: z.string().optional(),
    appleIssuerId: z.string().optional(),
    appleKeyContent: z.string().optional(),
    appleIndividualKeyId: z.string().optional(),
    appleIndividualKeyContent: z.string().optional(),
  })
  .strict();

const CouchdbBuildConfigSchema = z
  .object({
    couchdbUser: z.string().default('admin'),
    couchdbPassword: z
      .string()
      .default('aSecretPasswordThatCantBeGuessed'),
    couchdbExternalPort: z.number().int().positive().default(5984),
    conductorExternalPort: z.number().int().positive().default(8080),
    conductorInternalPort: z.number().int().positive().default(8080),
  })
  .strict();

const DevBuildConfigSchema = z
  .object({
    developerMode: z.boolean().default(false),
    debugApp: z.boolean().default(false),
    debugPouchDb: z.boolean().default(false),
    showWipe: z.boolean().default(true),
    showPouchDbBrowser: z.boolean().default(true),
  })
  .strict();

const PouchdbBuildConfigSchema = z
  .object({
    pouchBatchSize: z.number().int().positive().default(10),
    pouchBatchesLimit: z.number().int().positive().default(10),
  })
  .strict();

/**
 * The canonical config as produced by the schema (after defaults + invariants
 * are applied). Defined independently of the schema so that the top-level
 * `.transform()` does not create a circular type (zod 4 + tsc).
 */
export type SharedBuildConfig = {
  endpoints: z.infer<typeof EndpointsBuildConfigSchema>;
  branding: z.infer<typeof BrandingBuildConfigSchema>;
  support: z.infer<typeof SupportBuildConfigSchema>;
  notebookAndRecordUX: z.infer<typeof NotebookAndRecordUxBuildConfigSchema>;
  maps: z.infer<typeof MapsBuildConfigSchema>;
  sync: z.infer<typeof SyncBuildConfigSchema>;
  attachments: z.infer<typeof AttachmentsBuildConfigSchema>;
  migration: z.infer<typeof MigrationBuildConfigSchema>;
  auth: z.infer<typeof AuthBuildConfigSchema>;
  authProviders: z.infer<typeof AuthProviderConfigMapSchema>;
  authTokens: z.infer<typeof AuthTokensBuildConfigSchema>;
  limits: z.infer<typeof LimitsBuildConfigSchema>;
  email: z.infer<typeof EmailBuildConfigSchema>;
  observability: z.infer<typeof ObservabilityBuildConfigSchema>;
  teamAndRolePolicy: z.infer<typeof TeamAndRolePolicyBuildConfigSchema>;
  webDesignerLimits: z.infer<typeof WebDesignerLimitsBuildConfigSchema>;
  android: z.infer<typeof AndroidBuildConfigSchema>;
  ios: z.infer<typeof IosBuildConfigSchema>;
  couchdb: z.infer<typeof CouchdbBuildConfigSchema>;
  dev: z.infer<typeof DevBuildConfigSchema>;
  pouchdb: z.infer<typeof PouchdbBuildConfigSchema>;
};

/**
 * Applies the shared cross-field invariants (ADR-0001 D4) so that every
 * entry point (JSON, generated app env, generated api env) yields the same
 * canonical semantics:
 *  - short / heading names fall back to the app name
 *  - offline maps are forced off for OSM (no bulk download)
 *  - long-lived token hints are clamped to the max duration, deduped, sorted
 */
function applySharedInvariants(c: SharedBuildConfig): SharedBuildConfig {
  if (!c.branding.appShortName) c.branding.appShortName = c.branding.appName;
  if (!c.branding.headingAppName) c.branding.headingAppName = c.branding.appName;
  if (c.maps.mapSource === 'osm') c.maps.offlineMaps = false;
  const maxDays = c.authTokens.maximumLongLivedDurationDays;
  // 'unlimited' means no cap, so the hints are left unclamped.
  if (typeof maxDays === 'number') {
    let hints = (c.authTokens.longLivedTokenDurationHints ?? []).filter(
      (hint: number) => hint <= maxDays
    );
    if (hints.length === 0) hints = [maxDays];
    c.authTokens.longLivedTokenDurationHints = [...new Set(hints)].sort(
      (a: number, b: number) => a - b
    );
  }
  return c;
}

export const BuildConfigSchema = z
  .object({
    endpoints: EndpointsBuildConfigSchema.default(() => EndpointsBuildConfigSchema.parse({})),
    branding: BrandingBuildConfigSchema.default(() => BrandingBuildConfigSchema.parse({})),
    support: SupportBuildConfigSchema.default(() => SupportBuildConfigSchema.parse({})),
    notebookAndRecordUX: NotebookAndRecordUxBuildConfigSchema.default(() => NotebookAndRecordUxBuildConfigSchema.parse({})),
    maps: MapsBuildConfigSchema.default(() => MapsBuildConfigSchema.parse({})),
    sync: SyncBuildConfigSchema.default(() => SyncBuildConfigSchema.parse({})),
    attachments: AttachmentsBuildConfigSchema.default(() => AttachmentsBuildConfigSchema.parse({})),
    migration: MigrationBuildConfigSchema.default(() => MigrationBuildConfigSchema.parse({})),
    auth: AuthBuildConfigSchema.default(() => AuthBuildConfigSchema.parse({})),
    authProviders: AuthProviderConfigMapSchema.default(() => AuthProviderConfigMapSchema.parse({})),
    authTokens: AuthTokensBuildConfigSchema.default(() => AuthTokensBuildConfigSchema.parse({})),
    limits: LimitsBuildConfigSchema.default(() => LimitsBuildConfigSchema.parse({})),
    email: EmailBuildConfigSchema.default(() => EmailBuildConfigSchema.parse({})),
    observability: ObservabilityBuildConfigSchema.default(() => ObservabilityBuildConfigSchema.parse({})),
    teamAndRolePolicy: TeamAndRolePolicyBuildConfigSchema.default(() => TeamAndRolePolicyBuildConfigSchema.parse({})),
    webDesignerLimits: WebDesignerLimitsBuildConfigSchema.default(() => WebDesignerLimitsBuildConfigSchema.parse({})),
    android: AndroidBuildConfigSchema.default(() => AndroidBuildConfigSchema.parse({})),
    ios: IosBuildConfigSchema.default(() => IosBuildConfigSchema.parse({})),
    couchdb: CouchdbBuildConfigSchema.default(() => CouchdbBuildConfigSchema.parse({})),
    dev: DevBuildConfigSchema.default(() => DevBuildConfigSchema.parse({})),
    pouchdb: PouchdbBuildConfigSchema.default(() => PouchdbBuildConfigSchema.parse({})),
  })
  .strict()
  .transform(applySharedInvariants);

/**
 * Same shape as SharedBuildConfig. Kept as an alias so generator, contract
 * and parser share one canonical type name going forward.
 */
export const RuntimeConfigSchema = BuildConfigSchema;

export type RuntimeConfig = SharedBuildConfig;

/**
 * A config where each top-level group and its scalar fields may be absent.
 * Produced incrementally by parseAppsEnv / parseApiEnv and consumed by
 * toRuntimeConfig (whose schema fills the remaining defaults).
 */
export type PartialBuildConfig = {
  [K in keyof SharedBuildConfig]?: Partial<SharedBuildConfig[K]>;
};

export const GeneratedEnvSchema = z
  .object({
    VITE_APP_NAME: z.string().default('FAIMS'),
    VITE_APP_SHORT_NAME: z.string().default('FAIMS'),
    VITE_HEADING_APP_NAME: z.string().default('FAIMS'),
    VITE_APP_ID: z.string().default('org.fedarch.faims3'),
    VITE_CLUSTER_ADMIN_GROUP_NAME: z.string().default('cluster-admin'),
    VITE_THEME: z.string().default('default'),
    VITE_WEB_URL: z.string().default('http://localhost:3001'),
    VITE_API_URL: z.string().default('http://localhost:8080'),
    VITE_APP_URL: z.string().default('http://localhost:3000'),
    /** CSV of one or more Conductor URLs (each becomes a login option). */
    VITE_CONDUCTOR_URL: z.string().default(''),
    VITE_WEBSITE_TITLE: z.string().default('Control Centre'),
    VITE_NOTEBOOK_NAME: z.string().default('project'),
    VITE_NOTEBOOK_LIST_TYPE: z.enum(['tabs', 'headings']).default('tabs'),
    VITE_SUPPORT_EMAIL: z.string().default('support@fieldmark.au'),
    VITE_DIRECTORY_USERNAME: z.string().default(''),
    VITE_DIRECTORY_PASSWORD: z.string().default(''),
    VITE_APP_PRIVACY_POLICY_URL: z
      .string()
      .default('https://fieldnote.au/privacy'),
    VITE_APP_CONTACT_URL: z.string().default(''),
    VITE_MAP_SOURCE: z.enum(['osm', 'maptiler', '']).default('osm'),
    VITE_MAP_SOURCE_KEY: z.string().default(''),
    VITE_MAP_STYLE: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic'),
    VITE_SATELLITE_SOURCE: z.enum(['', 'esri', 'maptiler']).default(''),
    VITE_OFFLINE_MAPS: BoolEnvSchema.default(false),
    VITE_BUGSNAG_KEY: z.string().default(''),
    VITE_COMMIT_VERSION: z.string().default('local-build'),
    VITE_FORCE_REMOTE_DELETION: z.enum(['allow', 'never']).default('never'),
    VITE_DELETE_ON_DEACTIVATION: BoolEnvSchema.default(false),
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: PositiveIntStringSchema.default(500),
    VITE_TOKEN_REFRESH_INTERVAL_MS: PositiveIntStringSchema.default(15000),
    VITE_TOKEN_REFRESH_WINDOW_MS: PositiveIntStringSchema.default(60000),
    VITE_LOGIN_BANNER_GRACE_MS: PositiveIntStringSchema.default(10000),
    VITE_IGNORE_TOKEN_EXP: BoolEnvSchema.default(false),
    VITE_NAVIGATION: z.enum(['none', 'breadcrumbs']).default('none'),
    VITE_SHOW_RECORD_LINKS: BoolEnvSchema.default(false),
    VITE_ATTACHMENT_SERVICE_TYPE: z.string().default('COUCH'),
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: z.string().default(''),
    VITE_MIGRATE_OLD_DATABASES: BoolEnvSchema.default(false),
    VITE_SHOW_WIPE: BoolEnvSchema.default(true),
    VITE_SHOW_POUCHDB_BROWSER: BoolEnvSchema.default(true),
    VITE_SHOW_NEW_NOTEBOOK: BoolEnvSchema.default(true),
    VITE_SHOW_STATUS_TAB: BoolEnvSchema.default(true),
    VITE_DEBUG_APP: BoolEnvSchema.default(false),
    VITE_DEBUG_POUCHDB: BoolEnvSchema.default(false),
    VITE_POUCH_BATCH_SIZE: PositiveIntStringSchema.default(10),
    VITE_POUCH_BATCHES_LIMIT: PositiveIntStringSchema.default(10),
    VITE_DEVELOPER_MODE: BoolEnvSchema.default(false),
    VITE_AUTOSUGGEST_SOURCE: z
      .enum(['NONE', 'MAPBOX', 'MAPTILER'])
      .default('NONE'),
    VITE_AUTOSUGGEST_MAPBOX_KEY: z.string().default(''),
    VITE_AUTOSUGGEST_MAPTILER_KEY: z.string().default(''),
    VITE_MAPBOX_ADDRESS_COUNTRY: z.string().default('AU'),
    VITE_MAPTILER_ADDRESS_COUNTRY: z.string().default('AU'),

    // iOS build/signing keys consumed by Fastlane (see env-contract.ts).
    VITE_APPLE_BUNDLE_IDENTIFIER: z.string().default(''),
    VITE_APP_STORE_CONNECT_TEAM_ID: z.string().default(''),

    VITE_DOCS_URL: z.string().default(''),
    VITE_MAX_DESIGN_FILE_SIZE_MB: PositiveIntStringSchema.default(10),
    VITE_TEMPLATE_PROTECTIONS: BoolEnvSchema.default(false),
    VITE_ENABLE_PLANS_IN_DESIGNER: BoolEnvSchema.default(true),
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().default('90'),
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: z.string().default('1,5,10,30,90,365'),
    VITE_EXCLUDED_TEAM_ROLES: z.string().default(''),
  })
  .passthrough();

export type GeneratedEnv = z.infer<typeof GeneratedEnvSchema>;

// ---------------------------------------------------------------------------
// API env: the server-side half of the generated env (no VITE_ prefix).
// Parsed with the same strict coercion helpers as the apps env so the two
// halves agree. Every field is optional so a partial (e.g. apps-only) env
// still parses; the canonical defaults in BuildConfigSchema fill the rest.
// ---------------------------------------------------------------------------

export const ApiEnvSchema = z
  .object({
    CONDUCTOR_PUBLIC_URL: z.string().optional(),
    WEB_APP_PUBLIC_URL: z.string().optional(),
    ANDROID_APP_PUBLIC_URL: z.string().optional(),
    IOS_APP_PUBLIC_URL: z.string().optional(),
    COUCHDB_INTERNAL_URL: z.string().optional(),
    COUCHDB_PUBLIC_URL: z.string().optional(),
    COUCHDB_USER: z.string().optional(),
    COUCHDB_PASSWORD: z.string().optional(),
    COUCHDB_EXTERNAL_PORT: PositiveIntStringSchema.optional(),
    CONDUCTOR_EXTERNAL_PORT: PositiveIntStringSchema.optional(),
    CONDUCTOR_INTERNAL_PORT: PositiveIntStringSchema.optional(),
    NEW_CONDUCTOR_URL: z.string().optional(),
    REDIRECT_WHITELIST: z.string().optional(),
    PROFILE_NAME: z.string().optional(),
    KEY_FILE_PATH: z.string().optional(),
    CONDUCTOR_INSTANCE_NAME: z.string().optional(),
    CONDUCTOR_DESCRIPTION: z.string().optional(),
    CONDUCTOR_SHORT_CODE_PREFIX: z.string().optional(),
    FAIMS_COOKIE_SECRET: z.string().optional(),
    KEY_SOURCE: z.enum(['FILE', 'ENV', 'AWS_SM']).optional(),
    AWS_SECRET_KEY_ARN: z.string().optional(),
    DISABLE_LOCAL_LOGIN: BoolEnvSchema.optional(),
    PROVISION_SSO_USERS_POLICY: z
      .enum(['own-team', 'general-user', 'reject'])
      .optional(),
    ACCESS_TOKEN_EXPIRY_MINUTES: PositiveIntStringSchema.optional(),
    REFRESH_TOKEN_EXPIRY_MINUTES: PositiveIntStringSchema.optional(),
    IMPERSONATION_SESSION_EXPIRY_MINUTES: PositiveIntStringSchema.optional(),
    EMAIL_CODE_EXPIRY_MINUTES: PositiveIntStringSchema.optional(),
    MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().optional(),
    DISABLE_MIGRATE_ON_STARTUP: BoolEnvSchema.optional(),
    STARTUP_MIGRATION_LOCK_ENABLED: BoolEnvSchema.optional(),
    STARTUP_MIGRATION_LOCK_TIMEOUT_MS: PositiveIntStringSchema.optional(),
    DEVELOPER_MODE: BoolEnvSchema.optional(),
    RATE_LIMITER_ENABLED: BoolEnvSchema.optional(),
    RATE_LIMITER_WINDOW_MS: PositiveIntStringSchema.optional(),
    RATE_LIMITER_PER_WINDOW: PositiveIntStringSchema.optional(),
    EXPORT_RATE_LIMITER_ENABLED: BoolEnvSchema.optional(),
    EXPORT_RATE_LIMITER_WINDOW_MS: PositiveIntStringSchema.optional(),
    EXPORT_RATE_LIMITER_PER_WINDOW: PositiveIntStringSchema.optional(),
    ATTEMPT_LIMITER_ENABLED: BoolEnvSchema.optional(),
    EMAIL_SERVICE_TYPE: z.enum(['SMTP', 'MOCK']).optional(),
    EMAIL_FROM_ADDRESS: z.string().optional(),
    EMAIL_FROM_NAME: z.string().optional(),
    EMAIL_REPLY_TO: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: PositiveIntStringSchema.optional(),
    SMTP_SECURE: BoolEnvSchema.optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_CACHE_EXPIRY_SECONDS: PositiveIntStringSchema.optional(),
    TEST_EMAIL_ADDRESS: z.string().optional(),
    BUGSNAG_API_KEY: z.string().optional(),
    JSON_BODY_LIMIT: z.string().optional(),
    URLENCODED_BODY_LIMIT: z.string().optional(),
    RESTORE_UPLOAD_MAX_BYTES: PositiveIntStringSchema.optional(),
    DOWNLOAD_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
    RECORDS_HYDRATED_PAGE_LIMIT: PositiveIntStringSchema.optional(),
  })
  .passthrough();

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Parse the API half of a generated env into a partial canonical config.
 * `AUTH_*` auth-provider keys are handled by the caller via
 * readAuthProviderConfigFromEnv.
 */
export function parseApiEnv(raw: Record<string, unknown>): PartialBuildConfig {
  const api = ApiEnvSchema.parse(raw);
  const maxDays =
    api.MAXIMUM_LONG_LIVED_DURATION_DAYS !== undefined
      ? parseMaxLongLivedDays(api.MAXIMUM_LONG_LIVED_DURATION_DAYS)
      : undefined;
  return {
    endpoints: {
      webUrl: api.NEW_CONDUCTOR_URL
        ? stripTrailingSlash(api.NEW_CONDUCTOR_URL)
        : api.CONDUCTOR_PUBLIC_URL,
      apiUrl: api.CONDUCTOR_PUBLIC_URL,
      appUrl: api.WEB_APP_PUBLIC_URL,
      androidAppPublicUrl: api.ANDROID_APP_PUBLIC_URL,
      iosAppPublicUrl: api.IOS_APP_PUBLIC_URL,
      couchdbInternalUrl: api.COUCHDB_INTERNAL_URL
        ? stripTrailingSlash(api.COUCHDB_INTERNAL_URL)
        : undefined,
      couchdbPublicUrl: api.COUCHDB_PUBLIC_URL
        ? stripTrailingSlash(api.COUCHDB_PUBLIC_URL)
        : undefined,
      redirectWhitelist: api.REDIRECT_WHITELIST
        ? OptionalCsvSchema.parse(api.REDIRECT_WHITELIST)
        : undefined,
    },
    branding: {
      conductorInstanceName: api.CONDUCTOR_INSTANCE_NAME,
      conductorDescription: api.CONDUCTOR_DESCRIPTION,
      conductorShortCodePrefix: api.CONDUCTOR_SHORT_CODE_PREFIX,
    },
    auth: {
      profileName: api.PROFILE_NAME,
      keyFilePath: api.KEY_FILE_PATH,
      keySource: api.KEY_SOURCE,
      awsSecretKeyArn: api.AWS_SECRET_KEY_ARN,
      cookieSecret: api.FAIMS_COOKIE_SECRET,
      disableLocalLogin: api.DISABLE_LOCAL_LOGIN,
      provisionSsoUsersPolicy: api.PROVISION_SSO_USERS_POLICY,
    },
    authTokens: {
      accessTokenExpiryMinutes: api.ACCESS_TOKEN_EXPIRY_MINUTES,
      refreshTokenExpiryMinutes: api.REFRESH_TOKEN_EXPIRY_MINUTES,
      impersonationSessionExpiryMinutes: api.IMPERSONATION_SESSION_EXPIRY_MINUTES,
      emailCodeExpiryMinutes: api.EMAIL_CODE_EXPIRY_MINUTES,
      maximumLongLivedDurationDays: maxDays,
    },
    migration: {
      disableMigrateOnStartup: api.DISABLE_MIGRATE_ON_STARTUP,
      startupMigrationLockEnabled: api.STARTUP_MIGRATION_LOCK_ENABLED,
      startupMigrationLockTimeoutMs: api.STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
    },
    limits: {
      rateLimiterEnabled: api.RATE_LIMITER_ENABLED,
      rateLimiterWindowMs: api.RATE_LIMITER_WINDOW_MS,
      rateLimiterPerWindow: api.RATE_LIMITER_PER_WINDOW,
      exportRateLimiterEnabled: api.EXPORT_RATE_LIMITER_ENABLED,
      exportRateLimiterWindowMs: api.EXPORT_RATE_LIMITER_WINDOW_MS,
      exportRateLimiterPerWindow: api.EXPORT_RATE_LIMITER_PER_WINDOW,
      attemptLimiterEnabled: api.ATTEMPT_LIMITER_ENABLED,
      jsonBodyLimit: api.JSON_BODY_LIMIT,
      urlencodedBodyLimit: api.URLENCODED_BODY_LIMIT,
      restoreUploadMaxBytes: api.RESTORE_UPLOAD_MAX_BYTES,
      downloadCookieSameSite: api.DOWNLOAD_COOKIE_SAMESITE,
      recordsHydratedPageLimit: api.RECORDS_HYDRATED_PAGE_LIMIT,
    },
    email: {
      emailServiceType: api.EMAIL_SERVICE_TYPE,
      emailFromAddress: api.EMAIL_FROM_ADDRESS,
      emailFromName: api.EMAIL_FROM_NAME,
      emailReplyTo: api.EMAIL_REPLY_TO,
      smtpHost: api.SMTP_HOST,
      smtpPort: api.SMTP_PORT,
      smtpSecure: api.SMTP_SECURE,
      smtpUser: api.SMTP_USER,
      smtpPassword: api.SMTP_PASSWORD,
      smtpCacheExpirySeconds: api.SMTP_CACHE_EXPIRY_SECONDS,
      testEmailAddress: api.TEST_EMAIL_ADDRESS,
    },
    observability: {
      bugsnagApiKey: parseBugsnagKey(api.BUGSNAG_API_KEY),
    },
    couchdb: {
      couchdbUser: api.COUCHDB_USER,
      couchdbPassword: api.COUCHDB_PASSWORD,
      couchdbExternalPort: api.COUCHDB_EXTERNAL_PORT,
      conductorExternalPort: api.CONDUCTOR_EXTERNAL_PORT,
      conductorInternalPort: api.CONDUCTOR_INTERNAL_PORT,
    },
    dev: {
      developerMode: api.DEVELOPER_MODE,
    },
  };
}

/**
 * Parse an apps (VITE_*) env into a partial canonical config. Kept as a
 * building block of parseGeneratedEnv.
 */
export function parseAppsEnv(env: GeneratedEnv): PartialBuildConfig {
  return {
    endpoints: {
      webUrl: env.VITE_WEB_URL,
      apiUrl: env.VITE_API_URL,
      appUrl: env.VITE_APP_URL,
      conductorUrls: OptionalCsvSchema.parse(env.VITE_CONDUCTOR_URL),
    },
    branding: {
      appName: env.VITE_APP_NAME,
      // Empty strings round-trip back to undefined so the appName fallbacks
      // (ADR-0001 D4) apply uniformly in JSON, generated env and parse output.
      appShortName: env.VITE_APP_SHORT_NAME || undefined,
      headingAppName: env.VITE_HEADING_APP_NAME || undefined,
      websiteTitle: env.VITE_WEBSITE_TITLE,
      theme: env.VITE_THEME,
    },
    support: {
      supportEmail: env.VITE_SUPPORT_EMAIL,
      privacyPolicyUrl: env.VITE_APP_PRIVACY_POLICY_URL,
      appContactUrl: env.VITE_APP_CONTACT_URL,
      docsUrl: env.VITE_DOCS_URL,
    },
    notebookAndRecordUX: {
      notebookName: env.VITE_NOTEBOOK_NAME,
      notebookListType: env.VITE_NOTEBOOK_LIST_TYPE,
      navigation: env.VITE_NAVIGATION,
      showRecordLinks: env.VITE_SHOW_RECORD_LINKS,
      showStatusTab: env.VITE_SHOW_STATUS_TAB,
      showNewNotebook: env.VITE_SHOW_NEW_NOTEBOOK,
    },
    maps: {
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource:
        env.VITE_SATELLITE_SOURCE === ''
          ? undefined
          : env.VITE_SATELLITE_SOURCE,
      offlineMaps: env.VITE_OFFLINE_MAPS,
      autosuggestSource: env.VITE_AUTOSUGGEST_SOURCE,
      autosuggestMapboxKey: env.VITE_AUTOSUGGEST_MAPBOX_KEY,
      autosuggestMapTilerKey: env.VITE_AUTOSUGGEST_MAPTILER_KEY,
      mapboxAddressCountry: UpperCsvSchema.parse(env.VITE_MAPBOX_ADDRESS_COUNTRY),
      maptilerAddressCountry: UpperCsvSchema.parse(
        env.VITE_MAPTILER_ADDRESS_COUNTRY
      ),
    },
    sync: {
      forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
      deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
      syncPushOnlyRecordThreshold: env.VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
    },
    attachments: {
      attachmentServiceType: env.VITE_ATTACHMENT_SERVICE_TYPE,
      attachmentDocumentIdPrefix:
        env.VITE_ATTACHMENT_DOCUMENT_ID_PREFIX || undefined,
    },
    authTokens: {
      tokenRefreshIntervalMs: env.VITE_TOKEN_REFRESH_INTERVAL_MS,
      tokenRefreshWindowMs: env.VITE_TOKEN_REFRESH_WINDOW_MS,
      loginBannerGraceMs: env.VITE_LOGIN_BANNER_GRACE_MS,
      ignoreTokenExp: env.VITE_IGNORE_TOKEN_EXP,
      maximumLongLivedDurationDays: parseMaxLongLivedDays(
        env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS
      ),
      longLivedTokenDurationHints: OptionalCsvSchema.parse(
        env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS
      )
        .map(item => Number.parseInt(item, 10))
        .filter(item => Number.isFinite(item) && item > 0),
    },
    migration: {
      migrateOldDatabases: env.VITE_MIGRATE_OLD_DATABASES,
    },
    dev: {
      showWipe: env.VITE_SHOW_WIPE,
      showPouchDbBrowser: env.VITE_SHOW_POUCHDB_BROWSER,
      debugApp: env.VITE_DEBUG_APP,
      debugPouchDb: env.VITE_DEBUG_POUCHDB,
      developerMode: env.VITE_DEVELOPER_MODE,
    },
    pouchdb: {
      pouchBatchSize: env.VITE_POUCH_BATCH_SIZE,
      pouchBatchesLimit: env.VITE_POUCH_BATCHES_LIMIT,
    },
    observability: {
      // Reject the same garbage the app hides (commit hash / release stamp
      // only); placeholder text resolves to the generator's default.
      // Sanitised: only a commit hash / release stamp survives; anything else
      // (blank, placeholder, prose) is `undefined`.
      commitVersion: sanitizeCommitVersion(env.VITE_COMMIT_VERSION),
      bugsnagApiKey: parseBugsnagKey(
        env.VITE_BUGSNAG_KEY
      ),
    },
    teamAndRolePolicy: {
      excludedTeamRoles: OptionalCsvSchema.parse(env.VITE_EXCLUDED_TEAM_ROLES),
    },
    webDesignerLimits: {
      maxDesignFileSizeMb: env.VITE_MAX_DESIGN_FILE_SIZE_MB,
      templateProtections: env.VITE_TEMPLATE_PROTECTIONS,
      enablePlansInDesigner: env.VITE_ENABLE_PLANS_IN_DESIGNER,
    },
    android: {
      appId: env.VITE_APP_ID,
    },
    ios: {
      bundleIdentifier: env.VITE_APPLE_BUNDLE_IDENTIFIER || env.VITE_APP_ID,
      appStoreConnectTeamId: env.VITE_APP_STORE_CONNECT_TEAM_ID || undefined,
    },
    auth: {
      directoryUsername: env.VITE_DIRECTORY_USERNAME || undefined,
      directoryPassword: env.VITE_DIRECTORY_PASSWORD || undefined,
      clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
    },
  };
}

export function parseBuildConfig(raw: unknown): SharedBuildConfig {
  return BuildConfigSchema.parse(raw);
}

export function toRuntimeConfig(parsed: PartialBuildConfig): RuntimeConfig {
  return RuntimeConfigSchema.parse(parsed);
}

export function parseGeneratedEnv(raw: unknown): RuntimeConfig {
  const rawEnv = (raw ?? {}) as Record<string, unknown>;

  const hasAppsKey = Object.keys(rawEnv).some(key => key.startsWith('VITE_'));
  // Any non-VITE_ / non-AUTH_ key is part of the api half (the generator only
  // emits VITE_*, AUTH_* and the bare api keys). We do not need to enumerate
  // them to decide whether to run the api parser.
  const hasApiKey = Object.keys(rawEnv).some(
    key => !key.startsWith('VITE_') && !key.startsWith('AUTH_')
  );

  // Merge the apps and api halves (either or both). The api half wins on
  // shared keys because it is the deployment-specific value.
  let partial: PartialBuildConfig = {};
  if (hasAppsKey) {
    const env = GeneratedEnvSchema.parse(rawEnv);
    partial = {
      ...partial,
      ...parseAppsEnv(env),
    };
  }
  if (hasApiKey || Object.keys(rawEnv).some(k => k.startsWith('AUTH_'))) {
    const apiPartial = parseApiEnv(rawEnv);
    partial = mergePartial(partial, apiPartial);
  }

  const authProviders = readAuthProviderConfigFromEnv(rawEnv as Record<string, string | undefined>);
  partial = {
    ...partial,
    ...(authProviders && Object.keys(authProviders).length ? {authProviders} : {}),
  };

  return toRuntimeConfig(partial);
}

/** Drop undefined values so they do not clobber a present sibling on merge. */
function definedOnly(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Deep-merge two partial configs one level deep (groups -> scalars): for each
 * group, a defined right-side field wins over a left-side field; undefined
 * right-side fields are ignored so an absent api value does not clobber a
 * present apps value (and vice versa).
 */
function mergePartial(
  left: PartialBuildConfig,
  right: PartialBuildConfig
): PartialBuildConfig {
  const out: Record<string, unknown> = {};
  const groups = new Set([
    ...Object.keys(left),
    ...Object.keys(right),
  ] as (keyof SharedBuildConfig)[]);
  for (const group of groups) {
    const leftVal = (left as Record<string, unknown>)[group];
    const rightVal = (right as Record<string, unknown>)[group];
    if (leftVal && typeof leftVal === 'object' && rightVal && typeof rightVal === 'object') {
      out[group] = {
        ...definedOnly(leftVal),
        ...definedOnly(rightVal),
      };
    } else if (rightVal !== undefined) {
      out[group] = rightVal;
    } else {
      out[group] = leftVal;
    }
  }
  return out as Partial<SharedBuildConfig>;
}
