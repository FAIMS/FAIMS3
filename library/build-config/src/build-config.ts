import {z} from 'zod';

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

export const AppBuildConfigSchema = z
  .object({
    appName: z.string().default('FAIMS').optional(),
    appShortName: z.string().optional(),
    commitVersion: z
      .string()
      .default('output of `git rev-parse HEAD`')
      .optional(),
    headingAppName: z.string().optional(),
    appId: z.string().default('org.fedarch.faims3').optional(),
    clusterAdminGroupName: z.string().default('cluster-admin').optional(),
    theme: z.string().default('default').optional(),
    notebookName: z.string().default('notebook').optional(),
    notebookListType: z.enum(['tabs', 'headings']).default('tabs').optional(),
    supportEmail: z.string().default('support@fieldmark.au').optional(),
    privacyPolicyUrl: z
      .string()
      .default('https://fieldnote.au/privacy')
      .optional(),
    appContactUrl: z.string().default('').optional(),
    directoryUsername: z.string().optional(),
    directoryPassword: z.string().optional(),
    syncPushOnlyRecordThreshold: z
      .number()
      .int()
      .positive()
      .default(500)
      .optional(),
    tokenRefreshIntervalMs: z
      .number()
      .int()
      .positive()
      .default(15000)
      .optional(),
    tokenRefreshWindowMs: z.number().int().positive().default(60000).optional(),
    loginBannerGraceMs: z.number().int().positive().default(10000).optional(),
    ignoreTokenExp: z.boolean().default(false).optional(),
    navigation: z.enum(['none', 'breadcrumbs']).default('none').optional(),
    showRecordLinks: z.boolean().default(false).optional(),
    attachmentServiceType: z.string().default('COUCH').optional(),
    attachmentDocumentIdPrefix: z.string().optional(),
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
    forceRemoteDeletion: z.enum(['allow', 'never']).default('never').optional(),
    deleteOnDeactivation: z.boolean().default(false).optional(),
    migrateOldDatabases: z.boolean().default(false).optional(),
    showWipe: z.boolean().default(true).optional(),
    showPouchDbBrowser: z.boolean().default(true).optional(),
    showNewNotebook: z.boolean().default(true).optional(),
    showStatusTab: z.boolean().default(true).optional(),
    debugApp: z.boolean().default(false).optional(),
    debugPouchDb: z.boolean().default(false).optional(),
    pouchBatchSize: z.number().int().positive().default(10).optional(),
    pouchBatchesLimit: z.number().int().positive().default(10).optional(),
    excludedTeamRoles: z.array(z.string()).default([]).optional(),
    bugsnagApiKey: z.string().optional(),
    developerMode: z.boolean().default(false).optional(),
  })
  .strict();

export const UrlBuildConfigSchema = z
  .object({
    webUrl: z.string().default('http://localhost:3001').optional(),
    apiUrl: z.string().default('http://localhost:8080').optional(),
    appUrl: z.string().default('http://localhost:3000').optional(),
  })
  .strict();

export const WebBuildConfigSchema = z
  .object({
    websiteTitle: z.string().default('Control Centre').optional(),
    docsUrl: z.string().default('').optional(),
    bugsnagApiKey: z.string().optional(),
    maxDesignFileSizeMb: z.number().int().positive().default(10).optional(),
    maximumLongLivedDurationDays: z
      .union([z.number().int().positive(), z.string()])
      .optional(),
    longLivedTokenDurationHints: z
      .array(z.number().int().positive())
      .optional(),
    privacyPolicyUrl: z
      .string()
      .default('https://fieldnote.au/privacy')
      .optional(),
    excludedTeamRoles: z.array(z.string()).default([]).optional(),
  })
  .strict();

export const MobileBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3').optional(),
    android: z
      .object({
        appId: z.string().optional(),
        releaseStatus: z.string().default('draft').optional(),
        keystoreFileBase64: z.string().optional(),
        serviceAccountKeyJsonBase64: z.string().optional(),
        keystorePath: z.string().optional(),
        keystorePassword: z.string().optional(),
        keyAlias: z.string().optional(),
        keyPassword: z.string().optional(),
        serviceAccountJsonPath: z.string().optional(),
      })
      .strict()
      .default({}),
    ios: z
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
      .strict()
      .default({}),
  })
  .strict();

export const ApiBuildConfigSchema = z
  .object({
    profileName: z.string().default('local-dev').optional(),
    keyFilePath: z.string().default('.').optional(),
    conductorInstanceName: z
      .string()
      .default('Development FAIMS Server')
      .optional(),
    conductorDescription: z
      .string()
      .default('Development server on localhost')
      .optional(),
    conductorShortCodePrefix: z.string().default('DEV').optional(),
    couchdbUser: z.string().default('admin').optional(),
    couchdbPassword: z
      .string()
      .default('aSecretPasswordThatCantBeGuessed')
      .optional(),
    couchdbExternalPort: z.number().int().positive().default(5984).optional(),
    couchdbInternalUrl: z.string().default('http://localhost:5984').optional(),
    couchdbPublicUrl: z.string().default('http://localhost:5984').optional(),
    conductorExternalPort: z.number().int().positive().default(8080).optional(),
    conductorInternalPort: z.number().int().positive().default(8080).optional(),
    conductorPublicUrl: z.string().optional(),
    webAppPublicUrl: z.string().optional(),
    androidAppPublicUrl: z.string().default('').optional(),
    iosAppPublicUrl: z.string().default('').optional(),
    cookieSecret: z.string().default('').optional(),
    keySource: z.enum(['FILE', 'ENV', 'AWS_SM']).default('FILE').optional(),
    awsSecretKeyArn: z.string().optional(),
    refreshTokenExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(2880)
      .optional(),
    accessTokenExpiryMinutes: z.number().int().positive().default(5).optional(),
    impersonationSessionExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(60)
      .optional(),
    emailCodeExpiryMinutes: z.number().int().positive().default(30).optional(),
    disableMigrateOnStartup: z.boolean().default(false).optional(),
    startupMigrationLockEnabled: z.boolean().default(false).optional(),
    startupMigrationLockTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(1800000)
      .optional(),
    developerMode: z.boolean().default(false).optional(),
    disableLocalLogin: z.boolean().default(false).optional(),
    provisionSsoUsersPolicy: z
      .enum(['own-team', 'general-user', 'reject'])
      .default('reject')
      .optional(),
    rateLimiterWindowMs: z.number().int().positive().default(600000).optional(),
    rateLimiterPerWindow: z.number().int().positive().default(1000).optional(),
    rateLimiterEnabled: z.boolean().default(true).optional(),
    exportRateLimiterEnabled: z.boolean().default(true).optional(),
    exportRateLimiterWindowMs: z
      .number()
      .int()
      .positive()
      .default(600000)
      .optional(),
    exportRateLimiterPerWindow: z
      .number()
      .int()
      .positive()
      .default(20)
      .optional(),
    attemptLimiterEnabled: z.boolean().default(true).optional(),
    newConductorUrl: z.string().optional(),
    redirectWhitelist: z.array(z.string()).optional(),
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
    maximumLongLivedDurationDays: z
      .union([z.number().int().positive(), z.literal('unlimited')])
      .default(90)
      .optional(),
    bugsnagApiKey: z.string().optional(),
    jsonBodyLimit: z.string().default('25mb').optional(),
    urlencodedBodyLimit: z.string().default('1mb').optional(),
    restoreUploadMaxBytes: z
      .number()
      .int()
      .positive()
      .default(1073741824)
      .optional(),
    downloadCookieSameSite: z
      .enum(['lax', 'strict', 'none'])
      .default('lax')
      .optional(),
    recordsHydratedPageLimit: z.number().int().positive().default(150).optional(),
    extraEnv: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .default({})
      .optional(),
  })
  .strict();

export const BuildConfigSchema = z
  .object({
    urls: UrlBuildConfigSchema,
    app: AppBuildConfigSchema,
    web: WebBuildConfigSchema,
    mobile: MobileBuildConfigSchema,
    api: ApiBuildConfigSchema.default({}),
    secrets: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SharedBuildConfig = z.infer<typeof BuildConfigSchema>;

export const RuntimeConfigSchema = z
  .object({
    shared: z
      .object({
        urls: z
          .object({
            web: z.string(),
            api: z.string(),
            app: z.string(),
          })
          .strict(),
        branding: z
          .object({
            appName: z.string(),
            appShortName: z.string(),
            appId: z.string(),
            headingAppName: z.string(),
            theme: z.string(),
            clusterAdminGroupName: z.string(),
          })
          .strict(),
        notebook: z
          .object({
            name: z.string(),
            listType: z.enum(['tabs', 'headings']),
          })
          .strict(),
        support: z
          .object({
            supportEmail: z.string(),
            privacyPolicyUrl: z.string(),
            contactUrl: z.string(),
          })
          .strict(),
        maps: z
          .object({
            source: z.enum(['osm', 'maptiler', '']),
            sourceKey: z.string(),
            style: z.enum(['basic', 'openstreetmap', 'osm-bright', 'toner']),
            satelliteSource: z.enum(['esri', 'maptiler']).optional(),
            offlineMaps: z.boolean(),
          })
          .strict(),
        observability: z
          .object({
            bugsnagApiKey: z.string().optional(),
            commitVersion: z.string(),
          })
          .strict(),
        deletionPolicy: z
          .object({
            forceRemoteDeletion: z.enum(['allow', 'never']),
            deleteOnDeactivation: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    app: z
      .object({
        syncPushOnlyRecordThreshold: z.number().int().positive(),
        tokenRefreshIntervalMs: z.number().int().positive(),
        tokenRefreshWindowMs: z.number().int().positive(),
        loginBannerGraceMs: z.number().int().positive(),
        ignoreTokenExp: z.boolean(),
        navigation: z.enum(['none', 'breadcrumbs']),
        showRecordLinks: z.boolean(),
        attachmentServiceType: z.string(),
        directoryUsername: z.string().optional(),
        directoryPassword: z.string().optional(),
        attachmentDocumentIdPrefix: z.string().optional(),
        migrateOldDatabases: z.boolean(),
        developerMode: z.boolean(),
        debugApp: z.boolean(),
        debugPouchDb: z.boolean(),
        showWipe: z.boolean(),
        showPouchDbBrowser: z.boolean(),
        showNewNotebook: z.boolean(),
        showStatusTab: z.boolean(),
        pouchBatchSize: z.number().int().positive(),
        pouchBatchesLimit: z.number().int().positive(),
        autosuggest: z
          .object({
            source: z.enum(['NONE', 'MAPBOX', 'MAPTILER']),
            mapboxKey: z.string(),
            maptilerKey: z.string(),
            mapboxAddressCountry: z.string(),
            maptilerAddressCountry: z.string(),
          })
          .strict(),
      })
      .strict(),
    web: z
      .object({
        websiteTitle: z.string(),
        docsUrl: z.string(),
        maxDesignFileSizeMb: z.number().int().positive(),
        maximumLongLivedDurationDays: z.union([z.number().int().positive(), z.string()]),
        longLivedTokenDurationHints: z.array(z.number().int().positive()),
        excludedTeamRoles: z.array(z.string()),
      })
      .strict(),
    mobile: MobileBuildConfigSchema,
    api: z
      .object({
        profileName: z.string(),
        keyFilePath: z.string(),
        conductorInstanceName: z.string(),
        conductorDescription: z.string(),
        conductorShortCodePrefix: z.string(),
        couchdbUser: z.string(),
        couchdbPassword: z.string(),
        couchdbExternalPort: z.number().int().positive(),
        couchdbInternalUrl: z.string(),
        couchdbPublicUrl: z.string(),
        conductorExternalPort: z.number().int().positive(),
        conductorInternalPort: z.number().int().positive(),
        conductorPublicUrl: z.string(),
        webAppPublicUrl: z.string(),
        androidAppPublicUrl: z.string(),
        iosAppPublicUrl: z.string(),
        cookieSecret: z.string(),
        keySource: z.enum(['FILE', 'ENV', 'AWS_SM']),
        awsSecretKeyArn: z.string().optional(),
        refreshTokenExpiryMinutes: z.number().int().positive(),
        accessTokenExpiryMinutes: z.number().int().positive(),
        impersonationSessionExpiryMinutes: z.number().int().positive(),
        emailCodeExpiryMinutes: z.number().int().positive(),
        disableMigrateOnStartup: z.boolean(),
        startupMigrationLockEnabled: z.boolean(),
        startupMigrationLockTimeoutMs: z.number().int().positive(),
        developerMode: z.boolean(),
        disableLocalLogin: z.boolean(),
        provisionSsoUsersPolicy: z.enum(['own-team', 'general-user', 'reject']),
        rateLimiterWindowMs: z.number().int().positive(),
        rateLimiterPerWindow: z.number().int().positive(),
        rateLimiterEnabled: z.boolean(),
        exportRateLimiterEnabled: z.boolean(),
        exportRateLimiterWindowMs: z.number().int().positive(),
        exportRateLimiterPerWindow: z.number().int().positive(),
        attemptLimiterEnabled: z.boolean(),
        newConductorUrl: z.string(),
        redirectWhitelist: z.array(z.string()),
        emailServiceType: z.enum(['SMTP', 'MOCK']),
        emailFromAddress: z.string(),
        emailFromName: z.string(),
        emailReplyTo: z.string(),
        smtpHost: z.string(),
        smtpPort: z.number().int().positive(),
        smtpSecure: z.boolean(),
        smtpUser: z.string(),
        smtpPassword: z.string(),
        smtpCacheExpirySeconds: z.number().int().positive(),
        testEmailAddress: z.string(),
        maximumLongLivedDurationDays: z.union([
          z.number().int().positive(),
          z.literal('unlimited'),
        ]),
        bugsnagApiKey: z.string().optional(),
        jsonBodyLimit: z.string(),
        urlencodedBodyLimit: z.string(),
        restoreUploadMaxBytes: z.number().int().positive(),
        downloadCookieSameSite: z.enum(['lax', 'strict', 'none']),
        recordsHydratedPageLimit: z.number().int().positive(),
        extraEnv: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      })
      .strict(),
  })
  .strict();

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
  const appName = parsed.app.appName ?? 'FAIMS';
  const appShortName = parsed.app.appShortName ?? appName;
  const apiConfig =
    (parsed as unknown as {api?: z.input<typeof ApiBuildConfigSchema>}).api ??
    {};
  const appId =
    parsed.app.appId ??
    parsed.mobile.android.appId ??
    parsed.mobile.appId ??
    'org.fedarch.faims3';
  const apiPublicUrl = parsed.urls.apiUrl ?? 'http://localhost:8080';
  const webPublicUrl = parsed.urls.webUrl ?? 'http://localhost:3001';
  const appPublicUrl = parsed.urls.appUrl ?? 'http://localhost:3000';

  return RuntimeConfigSchema.parse({
    shared: {
      urls: {
        web: webPublicUrl,
        api: apiPublicUrl,
        app: appPublicUrl,
      },
      branding: {
        appName,
        appShortName,
        appId,
        headingAppName: parsed.app.headingAppName ?? appName,
        theme: parsed.app.theme ?? 'default',
        clusterAdminGroupName: parsed.app.clusterAdminGroupName ?? 'cluster-admin',
      },
      notebook: {
        name: parsed.app.notebookName ?? 'notebook',
        listType: parsed.app.notebookListType ?? 'tabs',
      },
      support: {
        supportEmail: parsed.app.supportEmail ?? 'support@fieldmark.au',
        privacyPolicyUrl:
          parsed.app.privacyPolicyUrl ??
          parsed.web.privacyPolicyUrl ??
          'https://fieldnote.au/privacy',
        contactUrl: parsed.app.appContactUrl ?? '',
      },
      maps: {
        source: parsed.app.mapSource ?? 'maptiler',
        sourceKey: parsed.app.mapSourceKey ?? '',
        style: parsed.app.mapStyle ?? 'basic',
        satelliteSource: parsed.app.satelliteSource,
        offlineMaps: parsed.app.offlineMaps ?? true,
      },
      observability: {
        bugsnagApiKey: parsed.app.bugsnagApiKey,
        commitVersion: parsed.app.commitVersion ?? 'local-build',
      },
      deletionPolicy: {
        forceRemoteDeletion: parsed.app.forceRemoteDeletion ?? 'never',
        deleteOnDeactivation: parsed.app.deleteOnDeactivation ?? false,
      },
    },
    app: {
      syncPushOnlyRecordThreshold: parsed.app.syncPushOnlyRecordThreshold ?? 500,
      tokenRefreshIntervalMs: parsed.app.tokenRefreshIntervalMs ?? 15000,
      tokenRefreshWindowMs: parsed.app.tokenRefreshWindowMs ?? 60000,
      loginBannerGraceMs: parsed.app.loginBannerGraceMs ?? 10000,
      ignoreTokenExp: parsed.app.ignoreTokenExp ?? false,
      navigation: parsed.app.navigation ?? 'none',
      showRecordLinks: parsed.app.showRecordLinks ?? false,
      attachmentServiceType: parsed.app.attachmentServiceType ?? 'COUCH',
      directoryUsername: parsed.app.directoryUsername,
      directoryPassword: parsed.app.directoryPassword,
      attachmentDocumentIdPrefix: parsed.app.attachmentDocumentIdPrefix,
      migrateOldDatabases: parsed.app.migrateOldDatabases ?? false,
      developerMode: parsed.app.developerMode ?? false,
      debugApp: parsed.app.debugApp ?? false,
      debugPouchDb: parsed.app.debugPouchDb ?? false,
      showWipe: parsed.app.showWipe ?? true,
      showPouchDbBrowser: parsed.app.showPouchDbBrowser ?? true,
      showNewNotebook: parsed.app.showNewNotebook ?? true,
      showStatusTab: parsed.app.showStatusTab ?? true,
      pouchBatchSize: parsed.app.pouchBatchSize ?? 10,
      pouchBatchesLimit: parsed.app.pouchBatchesLimit ?? 10,
      autosuggest: {
        source: parsed.app.autosuggestSource ?? 'NONE',
        mapboxKey: parsed.app.autosuggestMapboxKey ?? '',
        maptilerKey: parsed.app.autosuggestMapTilerKey ?? '',
        mapboxAddressCountry: parsed.app.mapboxAddressCountry ?? 'AU',
        maptilerAddressCountry: parsed.app.maptilerAddressCountry ?? 'AU',
      },
    },
    web: {
      websiteTitle: parsed.web.websiteTitle ?? 'Control Centre',
      docsUrl: parsed.web.docsUrl ?? '',
      maxDesignFileSizeMb: parsed.web.maxDesignFileSizeMb ?? 10,
      maximumLongLivedDurationDays:
        parsed.web.maximumLongLivedDurationDays ?? 90,
      longLivedTokenDurationHints:
        parsed.web.longLivedTokenDurationHints ?? [1, 5, 10, 30, 90, 365],
      excludedTeamRoles: parsed.web.excludedTeamRoles ?? [],
    },
    mobile: parsed.mobile,
    api: {
      profileName: apiConfig.profileName ?? 'local-dev',
      keyFilePath: apiConfig.keyFilePath ?? '.',
      conductorInstanceName:
        apiConfig.conductorInstanceName ?? 'Development FAIMS Server',
      conductorDescription:
        apiConfig.conductorDescription ?? 'Development server on localhost',
      conductorShortCodePrefix: apiConfig.conductorShortCodePrefix ?? 'DEV',
      couchdbUser: apiConfig.couchdbUser ?? 'admin',
      couchdbPassword:
        apiConfig.couchdbPassword ?? 'aSecretPasswordThatCantBeGuessed',
      couchdbExternalPort: apiConfig.couchdbExternalPort ?? 5984,
      couchdbInternalUrl: apiConfig.couchdbInternalUrl ?? 'http://localhost:5984',
      couchdbPublicUrl: apiConfig.couchdbPublicUrl ?? 'http://localhost:5984',
      conductorExternalPort: apiConfig.conductorExternalPort ?? 8080,
      conductorInternalPort: apiConfig.conductorInternalPort ?? 8080,
      conductorPublicUrl: apiConfig.conductorPublicUrl ?? apiPublicUrl,
      webAppPublicUrl: apiConfig.webAppPublicUrl ?? appPublicUrl,
      androidAppPublicUrl: apiConfig.androidAppPublicUrl ?? '',
      iosAppPublicUrl: apiConfig.iosAppPublicUrl ?? '',
      cookieSecret: apiConfig.cookieSecret ?? '',
      keySource: apiConfig.keySource ?? 'FILE',
      awsSecretKeyArn: apiConfig.awsSecretKeyArn,
      refreshTokenExpiryMinutes: apiConfig.refreshTokenExpiryMinutes ?? 2880,
      accessTokenExpiryMinutes: apiConfig.accessTokenExpiryMinutes ?? 5,
      impersonationSessionExpiryMinutes:
        apiConfig.impersonationSessionExpiryMinutes ?? 60,
      emailCodeExpiryMinutes: apiConfig.emailCodeExpiryMinutes ?? 30,
      disableMigrateOnStartup: apiConfig.disableMigrateOnStartup ?? false,
      startupMigrationLockEnabled:
        apiConfig.startupMigrationLockEnabled ?? false,
      startupMigrationLockTimeoutMs:
        apiConfig.startupMigrationLockTimeoutMs ?? 1800000,
      developerMode: apiConfig.developerMode ?? false,
      disableLocalLogin: apiConfig.disableLocalLogin ?? false,
      provisionSsoUsersPolicy: apiConfig.provisionSsoUsersPolicy ?? 'reject',
      rateLimiterWindowMs: apiConfig.rateLimiterWindowMs ?? 600000,
      rateLimiterPerWindow: apiConfig.rateLimiterPerWindow ?? 1000,
      rateLimiterEnabled: apiConfig.rateLimiterEnabled ?? true,
      exportRateLimiterEnabled: apiConfig.exportRateLimiterEnabled ?? true,
      exportRateLimiterWindowMs:
        apiConfig.exportRateLimiterWindowMs ?? 600000,
      exportRateLimiterPerWindow: apiConfig.exportRateLimiterPerWindow ?? 20,
      attemptLimiterEnabled: apiConfig.attemptLimiterEnabled ?? true,
      newConductorUrl: apiConfig.newConductorUrl ?? webPublicUrl,
      redirectWhitelist: apiConfig.redirectWhitelist ?? [
        apiPublicUrl,
        appPublicUrl,
        webPublicUrl,
        `${appId}://auth-return`,
      ],
      emailServiceType: apiConfig.emailServiceType ?? 'MOCK',
      emailFromAddress: apiConfig.emailFromAddress ?? 'notifications@example.com',
      emailFromName: apiConfig.emailFromName ?? 'FAIMS Notification',
      emailReplyTo: apiConfig.emailReplyTo ?? 'support@example.com',
      smtpHost: apiConfig.smtpHost ?? 'smtp.example.com',
      smtpPort: apiConfig.smtpPort ?? 587,
      smtpSecure: apiConfig.smtpSecure ?? true,
      smtpUser: apiConfig.smtpUser ?? 'smtp_username',
      smtpPassword: apiConfig.smtpPassword ?? 'smtp_password',
      smtpCacheExpirySeconds: apiConfig.smtpCacheExpirySeconds ?? 300,
      testEmailAddress: apiConfig.testEmailAddress ?? 'test@gmail.com',
      maximumLongLivedDurationDays:
        apiConfig.maximumLongLivedDurationDays ?? 90,
      bugsnagApiKey:
        apiConfig.bugsnagApiKey ?? parsed.app.bugsnagApiKey ?? undefined,
      jsonBodyLimit: apiConfig.jsonBodyLimit ?? '25mb',
      urlencodedBodyLimit: apiConfig.urlencodedBodyLimit ?? '1mb',
      restoreUploadMaxBytes: apiConfig.restoreUploadMaxBytes ?? 1073741824,
      downloadCookieSameSite: apiConfig.downloadCookieSameSite ?? 'lax',
      recordsHydratedPageLimit: apiConfig.recordsHydratedPageLimit ?? 150,
      extraEnv: apiConfig.extraEnv ?? {},
    },
  });
}

export function parseGeneratedEnv(raw: unknown): RuntimeConfig {
  const env = GeneratedEnvSchema.parse(raw);
  const buildConfig = parseBuildConfig({
    urls: {
      webUrl: env.VITE_WEB_URL,
      apiUrl: env.VITE_API_URL,
      appUrl: env.VITE_APP_URL,
    },
    app: {
      appName: env.VITE_APP_NAME,
      appShortName: env.VITE_APP_SHORT_NAME,
      headingAppName: env.VITE_HEADING_APP_NAME,
      appId: env.VITE_APP_ID,
      clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
      theme: env.VITE_THEME,
      commitVersion: env.VITE_COMMIT_VERSION,
      notebookName: env.VITE_NOTEBOOK_NAME,
      notebookListType: env.VITE_NOTEBOOK_LIST_TYPE,
      supportEmail: env.VITE_SUPPORT_EMAIL,
      directoryUsername: env.VITE_DIRECTORY_USERNAME || undefined,
      directoryPassword: env.VITE_DIRECTORY_PASSWORD || undefined,
      privacyPolicyUrl: env.VITE_APP_PRIVACY_POLICY_URL,
      appContactUrl: env.VITE_APP_CONTACT_URL,
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource:
        env.VITE_SATELLITE_SOURCE === ''
          ? undefined
          : env.VITE_SATELLITE_SOURCE,
      offlineMaps: env.VITE_OFFLINE_MAPS,
      bugsnagApiKey: env.VITE_BUGSNAG_KEY || env.VITE_BUGSNAG_API_KEY,
      forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
      deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
      syncPushOnlyRecordThreshold: env.VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
      tokenRefreshIntervalMs: env.VITE_TOKEN_REFRESH_INTERVAL_MS,
      tokenRefreshWindowMs: env.VITE_TOKEN_REFRESH_WINDOW_MS,
      loginBannerGraceMs: env.VITE_LOGIN_BANNER_GRACE_MS,
      ignoreTokenExp: env.VITE_IGNORE_TOKEN_EXP,
      navigation: env.VITE_NAVIGATION,
      showRecordLinks: env.VITE_SHOW_RECORD_LINKS,
      attachmentServiceType: env.VITE_ATTACHMENT_SERVICE_TYPE,
      attachmentDocumentIdPrefix:
        env.VITE_ATTACHMENT_DOCUMENT_ID_PREFIX || undefined,
      migrateOldDatabases: env.VITE_MIGRATE_OLD_DATABASES,
      showWipe: env.VITE_SHOW_WIPE,
      showPouchDbBrowser: env.VITE_SHOW_POUCHDB_BROWSER,
      showNewNotebook: env.VITE_SHOW_NEW_NOTEBOOK,
      showStatusTab: env.VITE_SHOW_STATUS_TAB,
      debugApp: env.VITE_DEBUG_APP,
      debugPouchDb: env.VITE_DEBUG_POUCHDB,
      pouchBatchSize: env.VITE_POUCH_BATCH_SIZE,
      pouchBatchesLimit: env.VITE_POUCH_BATCHES_LIMIT,
      developerMode: env.VITE_DEVELOPER_MODE,
      autosuggestSource: env.VITE_AUTOSUGGEST_SOURCE,
      autosuggestMapboxKey: env.VITE_AUTOSUGGEST_MAPBOX_KEY,
      autosuggestMapTilerKey: env.VITE_AUTOSUGGEST_MAPTILER_KEY,
      mapboxAddressCountry: env.VITE_MAPBOX_ADDRESS_COUNTRY,
      maptilerAddressCountry: env.VITE_MAPTILER_ADDRESS_COUNTRY,
      excludedTeamRoles: OptionalCsvSchema.parse(env.VITE_EXCLUDED_TEAM_ROLES),
    },
    web: {
      websiteTitle: env.VITE_WEBSITE_TITLE,
      docsUrl: env.VITE_DOCS_URL,
      bugsnagApiKey: env.VITE_BUGSNAG_API_KEY || env.VITE_BUGSNAG_KEY,
      maxDesignFileSizeMb: env.VITE_MAX_DESIGN_FILE_SIZE_MB,
      maximumLongLivedDurationDays:
        env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS,
      longLivedTokenDurationHints: OptionalCsvSchema.parse(
        env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS
      )
        .map(item => Number.parseInt(item, 10))
        .filter(item => Number.isFinite(item) && item > 0),
      privacyPolicyUrl: env.VITE_APP_PRIVACY_POLICY_URL,
      excludedTeamRoles: OptionalCsvSchema.parse(env.VITE_EXCLUDED_TEAM_ROLES),
    },
    mobile: {
      appId: env.VITE_APP_ID,
      android: {},
      ios: {
        bundleIdentifier: env.VITE_APP_ID,
      },
    },
    secrets: {},
  });

  return toRuntimeConfig(buildConfig);
}
