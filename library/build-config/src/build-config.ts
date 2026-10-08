import {z} from 'zod';
import {
  AuthProviderConfigMap,
  AuthProviderConfigMapSchema,
} from './auth-provider-config';

declare const __APP_VERSION__: string | undefined;
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

const OptionalStringSchema = z
  .string()
  .optional()
  .transform(value => {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }
    return value;
  });

const normalizeOptionalString = (value: string | undefined) => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value;
};

const withDefaultObject = <T extends z.ZodTypeAny>(schema: T) => {
  const defaultValue = schema.parse({} as z.input<T>) as z.util.NoUndefined<
    z.output<T>
  >;
  return schema.default(() => defaultValue);
};

const EndpointsBuildConfigSchema = z
  .object({
    webUrl: z.string().default('http://localhost:3001'),
    apiUrl: z.string().default('http://localhost:8080'),
    appUrl: z.string().default('http://localhost:3000'),
    couchdbInternalUrl: z.string().default('http://localhost:5984'),
    couchdbPublicUrl: z.string().default('http://localhost:5984'),
    androidAppPublicUrl: z.string().optional(),
    iosAppPublicUrl: z.string().optional(),
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
    conductorInstanceName: z.string().default('Development FAIMS Server'),
    conductorDescription: z.string().default('Development server on localhost'),
    conductorShortCodePrefix: z.string().default('DEV'),
  })
  .strict();

const SupportBuildConfigSchema = z
  .object({
    supportEmail: z.string().default('support@fieldmark.au'),
    privacyPolicyUrl: z.string().default('https://fieldnote.au/privacy'),
    appContactUrl: z.string().optional(),
    docsUrl: z.string().optional(),
  })
  .strict();

const NotebookAndRecordUxBuildConfigSchema = z
  .object({
    notebookName: z.string().default('notebook'),
    notebookListType: z.enum(['tabs', 'headings']).default('tabs'),
    navigation: z.enum(['none', 'breadcrumbs']).default('none'),
    showRecordLinks: z.boolean().default(false),
    showStatusTab: z.boolean().default(true),
    showNewNotebook: z.boolean().default(true),
  })
  .strict();

const MapsBuildConfigSchema = z
  .object({
    mapSource: z.enum(['osm', 'maptiler', '']).default('maptiler'),
    mapSourceKey: z.string().default(''),
    satelliteSource: z.enum(['esri', 'maptiler']).optional(),
    mapStyle: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic'),
    offlineMaps: z.boolean().default(true),
    autosuggestSource: z.enum(['NONE', 'MAPBOX', 'MAPTILER']).default('NONE'),
    autosuggestMapboxKey: z.string().optional(),
    autosuggestMapTilerKey: z.string().optional(),
    mapboxAddressCountry: z.string().default('AU'),
    maptilerAddressCountry: z.string().default('AU'),
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
    cookieSecret: z.string().optional(),
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
    commitVersion: z.string().default('output of `git rev-parse HEAD`'),
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

const MobileBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3'),
    android: withDefaultObject(AndroidBuildConfigSchema),
    ios: withDefaultObject(IosBuildConfigSchema),
  })
  .strict();

const CouchdbBuildConfigSchema = z
  .object({
    couchdbUser: z.string().default('admin'),
    couchdbPassword: z.string().default('aSecretPasswordThatCantBeGuessed'),
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

export const BuildConfigSchema = z
  .object({
    endpoints: withDefaultObject(EndpointsBuildConfigSchema),
    branding: withDefaultObject(BrandingBuildConfigSchema),
    support: withDefaultObject(SupportBuildConfigSchema),
    notebookAndRecordUX: withDefaultObject(NotebookAndRecordUxBuildConfigSchema),
    maps: withDefaultObject(MapsBuildConfigSchema),
    sync: withDefaultObject(SyncBuildConfigSchema),
    attachments: withDefaultObject(AttachmentsBuildConfigSchema),
    migration: withDefaultObject(MigrationBuildConfigSchema),
    auth: withDefaultObject(AuthBuildConfigSchema),
    authProviders: withDefaultObject(AuthProviderConfigMapSchema),
    authTokens: withDefaultObject(AuthTokensBuildConfigSchema),
    limits: withDefaultObject(LimitsBuildConfigSchema),
    email: withDefaultObject(EmailBuildConfigSchema),
    observability: withDefaultObject(ObservabilityBuildConfigSchema),
    teamAndRolePolicy: withDefaultObject(TeamAndRolePolicyBuildConfigSchema),
    webDesignerLimits: withDefaultObject(WebDesignerLimitsBuildConfigSchema),
    android: withDefaultObject(AndroidBuildConfigSchema),
    ios: withDefaultObject(IosBuildConfigSchema),
    couchdb: withDefaultObject(CouchdbBuildConfigSchema),
    dev: withDefaultObject(DevBuildConfigSchema),
    pouchdb: withDefaultObject(PouchdbBuildConfigSchema),
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
    VITE_DIRECTORY_USERNAME: OptionalStringSchema,
    VITE_DIRECTORY_PASSWORD: OptionalStringSchema,
    VITE_APP_PRIVACY_POLICY_URL: z
      .string()
      .default('https://fieldnote.au/privacy'),
    VITE_APP_CONTACT_URL: OptionalStringSchema,
    VITE_MAP_SOURCE: z.enum(['osm', 'maptiler', '']).default('maptiler'),
    VITE_MAP_SOURCE_KEY: z.string().default(''),
    VITE_MAP_STYLE: z
      .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
      .default('basic'),
    VITE_SATELLITE_SOURCE: z.enum(['', 'esri', 'maptiler']).default(''),
    VITE_OFFLINE_MAPS: TrueFalseSchema.default(false),
    VITE_BUGSNAG_KEY: OptionalStringSchema,
    VITE_BUGSNAG_API_KEY: OptionalStringSchema,
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
    VITE_DOCS_URL: OptionalStringSchema,
    VITE_MAX_DESIGN_FILE_SIZE_MB: PositiveIntStringSchema.default(10),
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().default('90'),
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: z.string().default('1,5,10,30,90,365'),
    VITE_EXCLUDED_TEAM_ROLES: z.string().default(''),
  })
  .loose();

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
      appContactUrl: normalizeOptionalString(env.VITE_APP_CONTACT_URL),
      docsUrl: normalizeOptionalString(env.VITE_DOCS_URL),
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
      bugsnagApiKey:
        normalizeOptionalString(env.VITE_BUGSNAG_KEY) ??
        normalizeOptionalString(env.VITE_BUGSNAG_API_KEY),
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
      directoryUsername: normalizeOptionalString(env.VITE_DIRECTORY_USERNAME),
      directoryPassword: normalizeOptionalString(env.VITE_DIRECTORY_PASSWORD),
      clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
    },
  });

  return toRuntimeConfig(buildConfig);
}

