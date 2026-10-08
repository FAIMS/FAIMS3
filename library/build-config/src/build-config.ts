import {z} from 'zod';
import {
  AuthProviderConfigMap,
  AuthProviderConfigMapSchema,
} from './auth-provider-config';
export {
  AuthProviderSchema,
  AuthProviderConfigMapSchema,
  readAuthProviderConfigFromEnv,
  buildAuthProviderEnvMap,
} from './auth-provider-config';

const TrueFalseSchema = z
  .enum(['true', 'false'])
  .transform(value => value === 'true');

const PositiveIntStringSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(value => Number.parseInt(value, 10))
  .pipe(z.number().int().positive());

const OptionalCsvSchema = z
  .string()
  .optional()
  .transform(value => {
    if (!value || value.trim() === '') {
      return [] as string[];
    }
    return value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  });

const EndpointsBuildConfigSchema = z
  .object({
    webUrl: z.string().default('http://localhost:3001').optional(),
    apiUrl: z.string().default('http://localhost:8080').optional(),
    appUrl: z.string().default('http://localhost:3000').optional(),
    couchdbInternalUrl: z.string().default('http://localhost:5984').optional(),
    couchdbPublicUrl: z.string().default('http://localhost:5984').optional(),
    androidAppPublicUrl: z.string().default('').optional(),
    iosAppPublicUrl: z.string().default('').optional(),
    redirectWhitelist: z.array(z.string()).optional(),
  })
  .strict();

const BrandingBuildConfigSchema = z
  .object({
    appName: z.string().default('FAIMS').optional(),
    appShortName: z.string().optional(),
    headingAppName: z.string().optional(),
    theme: z.string().default('default').optional(),
    websiteTitle: z.string().default('Control Centre').optional(),
    conductorInstanceName: z
      .string()
      .default('Development FAIMS Server')
      .optional(),
    conductorDescription: z
      .string()
      .default('Development server on localhost')
      .optional(),
    conductorShortCodePrefix: z.string().default('DEV').optional(),
  })
  .strict();

const SupportBuildConfigSchema = z
  .object({
    supportEmail: z.string().default('support@fieldmark.au').optional(),
    privacyPolicyUrl: z
      .string()
      .default('https://fieldnote.au/privacy')
      .optional(),
    appContactUrl: z.string().default('').optional(),
    docsUrl: z.string().default('').optional(),
  })
  .strict();

const NotebookAndRecordUxBuildConfigSchema = z
  .object({
    notebookName: z.string().default('notebook').optional(),
    notebookListType: z.enum(['tabs', 'headings']).default('tabs').optional(),
    navigation: z.enum(['none', 'breadcrumbs']).default('none').optional(),
    showRecordLinks: z.boolean().default(false).optional(),
    showStatusTab: z.boolean().default(true).optional(),
    showNewNotebook: z.boolean().default(true).optional(),
  })
  .strict();

const MapsBuildConfigSchema = z
  .object({
    mapSource: z.enum(['osm', 'maptiler', '']).default('maptiler').optional(),
    mapSourceKey: z.string().default('').optional(),
    satelliteSource: z.enum(['esri', 'maptiler']).optional(),
    mapStyle: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic')
      .optional(),
    offlineMaps: z.boolean().default(true).optional(),
    autosuggestSource: z
      .enum(['NONE', 'MAPBOX', 'MAPTILER'])
      .default('NONE')
      .optional(),
    autosuggestMapboxKey: z.string().default('').optional(),
    autosuggestMapTilerKey: z.string().default('').optional(),
    mapboxAddressCountry: z.string().default('AU').optional(),
    maptilerAddressCountry: z.string().default('AU').optional(),
  })
  .strict();

const SyncBuildConfigSchema = z
  .object({
    syncPushOnlyRecordThreshold: z.number().int().positive().default(500).optional(),
    forceRemoteDeletion: z.enum(['allow', 'never']).default('never').optional(),
    deleteOnDeactivation: z.boolean().default(false).optional(),
  })
  .strict();

const AttachmentsBuildConfigSchema = z
  .object({
    attachmentServiceType: z.string().default('COUCH').optional(),
    attachmentDocumentIdPrefix: z.string().optional(),
  })
  .strict();

const MigrationBuildConfigSchema = z
  .object({
    migrateOldDatabases: z.boolean().default(false).optional(),
    disableMigrateOnStartup: z.boolean().default(false).optional(),
    startupMigrationLockEnabled: z.boolean().default(false).optional(),
    startupMigrationLockTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(1800000)
      .optional(),
  })
  .strict();

const AuthBuildConfigSchema = z
  .object({
    clusterAdminGroupName: z.string().default('cluster-admin').optional(),
    directoryUsername: z.string().optional(),
    directoryPassword: z.string().optional(),
    profileName: z.string().default('local-dev').optional(),
    keyFilePath: z.string().default('.').optional(),
    keySource: z.enum(['FILE', 'ENV', 'AWS_SM']).default('FILE').optional(),
    awsSecretKeyArn: z.string().optional(),
    cookieSecret: z.string().default('').optional(),
    disableLocalLogin: z.boolean().default(false).optional(),
    provisionSsoUsersPolicy: z
      .enum(['own-team', 'general-user', 'reject'])
      .default('reject')
      .optional(),
  })
  .strict();

const AuthTokensBuildConfigSchema = z
  .object({
    tokenRefreshIntervalMs: z.number().int().positive().default(15000).optional(),
    tokenRefreshWindowMs: z.number().int().positive().default(60000).optional(),
    loginBannerGraceMs: z.number().int().positive().default(10000).optional(),
    ignoreTokenExp: z.boolean().default(false).optional(),
    longLivedTokenDurationHints: z.array(z.number().int().positive()).optional(),
    refreshTokenExpiryMinutes: z.number().int().positive().default(2880).optional(),
    accessTokenExpiryMinutes: z.number().int().positive().default(5).optional(),
    impersonationSessionExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(60)
      .optional(),
    emailCodeExpiryMinutes: z.number().int().positive().default(30).optional(),
    maximumLongLivedDurationDays: z
      .union([z.number().int().positive(), z.literal('unlimited')])
      .default(90)
      .optional(),
  })
  .strict();

const LimitsBuildConfigSchema = z
  .object({
    rateLimiterEnabled: z.boolean().default(true).optional(),
    rateLimiterWindowMs: z.number().int().positive().default(600000).optional(),
    rateLimiterPerWindow: z.number().int().positive().default(1000).optional(),
    exportRateLimiterEnabled: z.boolean().default(true).optional(),
    exportRateLimiterWindowMs: z.number().int().positive().default(600000).optional(),
    exportRateLimiterPerWindow: z.number().int().positive().default(20).optional(),
    attemptLimiterEnabled: z.boolean().default(true).optional(),
    jsonBodyLimit: z.string().default('25mb').optional(),
    urlencodedBodyLimit: z.string().default('1mb').optional(),
    restoreUploadMaxBytes: z.number().int().positive().default(1073741824).optional(),
    downloadCookieSameSite: z.enum(['lax', 'strict', 'none']).default('lax').optional(),
    recordsHydratedPageLimit: z.number().int().positive().default(150).optional(),
  })
  .strict();

const EmailBuildConfigSchema = z
  .object({
    emailServiceType: z.enum(['SMTP', 'MOCK']).default('MOCK').optional(),
    emailFromAddress: z.string().default('notifications@example.com').optional(),
    emailFromName: z.string().default('FAIMS Notification').optional(),
    emailReplyTo: z.string().default('support@example.com').optional(),
    smtpHost: z.string().default('smtp.example.com').optional(),
    smtpPort: z.number().int().positive().default(587).optional(),
    smtpSecure: z.boolean().default(true).optional(),
    smtpUser: z.string().default('smtp_username').optional(),
    smtpPassword: z.string().default('smtp_password').optional(),
    smtpCacheExpirySeconds: z.number().int().positive().default(300).optional(),
    testEmailAddress: z.string().default('test@gmail.com').optional(),
  })
  .strict();

const ObservabilityBuildConfigSchema = z
  .object({
    commitVersion: z
      .string()
      .default('output of `git rev-parse HEAD`')
      .optional(),
    bugsnagApiKey: z.string().optional(),
  })
  .strict();

const TeamAndRolePolicyBuildConfigSchema = z
  .object({
    excludedTeamRoles: z.array(z.string()).default([]).optional(),
  })
  .strict();

const WebDesignerLimitsBuildConfigSchema = z
  .object({
    maxDesignFileSizeMb: z.number().int().positive().default(10).optional(),
  })
  .strict();

const AndroidBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3').optional(),
    releaseStatus: z.string().default('draft').optional(),
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
    bundleIdentifier: z.string().default('org.fedarch.faims3').optional(),
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

const MobileBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3').optional(),
    android: AndroidBuildConfigSchema.default({}),
    ios: IosBuildConfigSchema.default({}),
  })
  .strict();

const CouchdbBuildConfigSchema = z
  .object({
    couchdbUser: z.string().default('admin').optional(),
    couchdbPassword: z
      .string()
      .default('aSecretPasswordThatCantBeGuessed')
      .optional(),
    couchdbExternalPort: z.number().int().positive().default(5984).optional(),
    conductorExternalPort: z.number().int().positive().default(8080).optional(),
    conductorInternalPort: z.number().int().positive().default(8080).optional(),
  })
  .strict();

const DevBuildConfigSchema = z
  .object({
    developerMode: z.boolean().default(false).optional(),
    debugApp: z.boolean().default(false).optional(),
    debugPouchDb: z.boolean().default(false).optional(),
    showWipe: z.boolean().default(true).optional(),
    showPouchDbBrowser: z.boolean().default(true).optional(),
  })
  .strict();

const PouchdbBuildConfigSchema = z
  .object({
    pouchBatchSize: z.number().int().positive().default(10).optional(),
    pouchBatchesLimit: z.number().int().positive().default(10).optional(),
  })
  .strict();

export const BuildConfigSchema = z
  .object({
    endpoints: EndpointsBuildConfigSchema.default({}),
    branding: BrandingBuildConfigSchema.default({}),
    support: SupportBuildConfigSchema.default({}),
    notebookAndRecordUX: NotebookAndRecordUxBuildConfigSchema.default({}),
    maps: MapsBuildConfigSchema.default({}),
    sync: SyncBuildConfigSchema.default({}),
    attachments: AttachmentsBuildConfigSchema.default({}),
    migration: MigrationBuildConfigSchema.default({}),
    auth: AuthBuildConfigSchema.default({}),
    authProviders: AuthProviderConfigMapSchema.default({}),
    authTokens: AuthTokensBuildConfigSchema.default({}),
    limits: LimitsBuildConfigSchema.default({}),
    email: EmailBuildConfigSchema.default({}),
    observability: ObservabilityBuildConfigSchema.default({}),
    teamAndRolePolicy: TeamAndRolePolicyBuildConfigSchema.default({}),
    webDesignerLimits: WebDesignerLimitsBuildConfigSchema.default({}),
    android: AndroidBuildConfigSchema.default({}),
    ios: IosBuildConfigSchema.default({}),
    couchdb: CouchdbBuildConfigSchema.default({}),
    dev: DevBuildConfigSchema.default({}),
    pouchdb: PouchdbBuildConfigSchema.default({}),
    secrets: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SharedBuildConfig = z.infer<typeof BuildConfigSchema>;

export const RuntimeConfigSchema = BuildConfigSchema;

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const GeneratedEnvSchema = z
  .object({
    VITE_APP_NAME: z.string().default('FAIMS'),
    VITE_APP_SHORT_NAME: z.string().default('FAIMS'),
    VITE_HEADING_APP_NAME: z.string().default('FAIMS'),
    VITE_APP_ID: z.string().default('org.fedarch.faims3'),
    VITE_CLUSTER_ADMIN_GROUP_NAME: z.string().default('cluster-admin'),
    VITE_THEME: z.string().default('default'),
    VITE_APP_THEME: z.string().default('default'),
    VITE_WEB_URL: z.string().default('http://localhost:3001'),
    VITE_API_URL: z.string().default('http://localhost:8080'),
    VITE_APP_URL: z.string().default('http://localhost:3000'),
    VITE_WEBSITE_TITLE: z.string().default('Control Centre'),
    VITE_NOTEBOOK_NAME: z.string().default('notebook'),
    VITE_NOTEBOOK_LIST_TYPE: z.enum(['tabs', 'headings']).default('tabs'),
    VITE_SUPPORT_EMAIL: z.string().default('support@fieldmark.au'),
    VITE_DIRECTORY_USERNAME: z.string().default(''),
    VITE_DIRECTORY_PASSWORD: z.string().default(''),
    VITE_APP_PRIVACY_POLICY_URL: z
      .string()
      .default('https://fieldnote.au/privacy'),
    VITE_APP_CONTACT_URL: z.string().default(''),
    VITE_MAP_SOURCE: z.enum(['osm', 'maptiler', '']).default('maptiler'),
    VITE_MAP_SOURCE_KEY: z.string().default(''),
    VITE_MAP_STYLE: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic'),
    VITE_SATELLITE_SOURCE: z.enum(['', 'esri', 'maptiler']).default(''),
    VITE_OFFLINE_MAPS: TrueFalseSchema.default(false),
    VITE_BUGSNAG_KEY: z.string().default('').optional(),
    VITE_BUGSNAG_API_KEY: z.string().default('').optional(),
    VITE_COMMIT_VERSION: z.string().default('local-build'),
    VITE_FORCE_REMOTE_DELETION: z.enum(['allow', 'never']).default('never'),
    VITE_DELETE_ON_DEACTIVATION: TrueFalseSchema.default(false),
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: PositiveIntStringSchema.default(500),
    VITE_TOKEN_REFRESH_INTERVAL_MS: PositiveIntStringSchema.default(15000),
    VITE_TOKEN_REFRESH_WINDOW_MS: PositiveIntStringSchema.default(60000),
    VITE_LOGIN_BANNER_GRACE_MS: PositiveIntStringSchema.default(10000),
    VITE_IGNORE_TOKEN_EXP: TrueFalseSchema.default(false),
    VITE_NAVIGATION: z.enum(['none', 'breadcrumbs']).default('none'),
    VITE_SHOW_RECORD_LINKS: TrueFalseSchema.default(false),
    VITE_ATTACHMENT_SERVICE_TYPE: z.string().default('COUCH'),
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: z.string().default(''),
    VITE_MIGRATE_OLD_DATABASES: TrueFalseSchema.default(false),
    VITE_SHOW_WIPE: TrueFalseSchema.default(true),
    VITE_SHOW_POUCHDB_BROWSER: TrueFalseSchema.default(true),
    VITE_SHOW_NEW_NOTEBOOK: TrueFalseSchema.default(true),
    VITE_SHOW_STATUS_TAB: TrueFalseSchema.default(true),
    VITE_DEBUG_APP: TrueFalseSchema.default(false),
    VITE_DEBUG_POUCHDB: TrueFalseSchema.default(false),
    VITE_POUCH_BATCH_SIZE: PositiveIntStringSchema.default(10),
    VITE_POUCH_BATCHES_LIMIT: PositiveIntStringSchema.default(10),
    VITE_DEVELOPER_MODE: TrueFalseSchema.default(false),
    VITE_AUTOSUGGEST_SOURCE: z
      .enum(['NONE', 'MAPBOX', 'MAPTILER'])
      .default('NONE'),
    VITE_AUTOSUGGEST_MAPBOX_KEY: z.string().default(''),
    VITE_AUTOSUGGEST_MAPTILER_KEY: z.string().default(''),
    VITE_MAPBOX_ADDRESS_COUNTRY: z.string().default('AU'),
    VITE_MAPTILER_ADDRESS_COUNTRY: z.string().default('AU'),
    VITE_DOCS_URL: z.string().default(''),
    VITE_MAX_DESIGN_FILE_SIZE_MB: PositiveIntStringSchema.default(10),
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().default('90'),
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: z.string().default('1,5,10,30,90,365'),
    VITE_EXCLUDED_TEAM_ROLES: z.string().default(''),
  })
  .strict();

export type GeneratedEnv = z.infer<typeof GeneratedEnvSchema>;

export function parseBuildConfig(raw: unknown): SharedBuildConfig {
  return BuildConfigSchema.parse(raw);
}

export function toRuntimeConfig(parsed: SharedBuildConfig): RuntimeConfig {
  return RuntimeConfigSchema.parse(parsed);
}

export function parseGeneratedEnv(raw: unknown): RuntimeConfig {
  const env = GeneratedEnvSchema.parse(raw);
  const buildConfig = parseBuildConfig({
    endpoints: {
      webUrl: env.VITE_WEB_URL,
      apiUrl: env.VITE_API_URL,
      appUrl: env.VITE_APP_URL,
    },
    branding: {
      appName: env.VITE_APP_NAME,
      appShortName: env.VITE_APP_SHORT_NAME,
      headingAppName: env.VITE_HEADING_APP_NAME,
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
      mapboxAddressCountry: env.VITE_MAPBOX_ADDRESS_COUNTRY,
      maptilerAddressCountry: env.VITE_MAPTILER_ADDRESS_COUNTRY,
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
      maximumLongLivedDurationDays:
        env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS === 'unlimited'
          ? 'unlimited'
          : Number.parseInt(env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS, 10),
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
      commitVersion: env.VITE_COMMIT_VERSION,
      bugsnagApiKey: env.VITE_BUGSNAG_KEY || env.VITE_BUGSNAG_API_KEY,
    },
    teamAndRolePolicy: {
      excludedTeamRoles: OptionalCsvSchema.parse(env.VITE_EXCLUDED_TEAM_ROLES),
    },
    webDesignerLimits: {
      maxDesignFileSizeMb: env.VITE_MAX_DESIGN_FILE_SIZE_MB,
    },
    android: {
      appId: env.VITE_APP_ID,
    },
    ios: {
      bundleIdentifier: env.VITE_APP_ID,
    },
    auth: {
      directoryUsername: env.VITE_DIRECTORY_USERNAME || undefined,
      directoryPassword: env.VITE_DIRECTORY_PASSWORD || undefined,
      clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
    },
  });

  return toRuntimeConfig(buildConfig);
}
