// SPDX-License-Identifier: Apache-2.0
import {
  DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  RuntimeConfig,
  SHARED_DEFAULTS,
} from './build-config.js';
import {buildAuthProviderEnvMap} from './auth-provider-config.js';
import {envValueToString, type EnvValue} from './env-value.js';

export {envValueToString, type EnvValue} from './env-value.js';

/** Which half of the generated env to emit (`all` writes both). */
export type SupportedPlatform = 'apps' | 'api' | 'all';

type EnvResolver = (runtime: RuntimeConfig) => EnvValue;

const baseContract: Record<string, EnvResolver> = {
  VITE_APP_NAME: runtime => runtime.branding.appName ?? '',
  // Falls back to the app name so an unset short name still
  // emits a usable value and round-trips losslessly.
  VITE_APP_SHORT_NAME: runtime =>
    runtime.branding.appShortName ?? runtime.branding.appName ?? '',
  VITE_COMMIT_VERSION: runtime =>
    runtime.observability.commitVersion ?? 'local-build',
  VITE_CONDUCTOR_URL: runtime =>
    runtime.endpoints.conductorUrls?.length
      ? runtime.endpoints.conductorUrls.join(',')
      : (runtime.endpoints.apiUrl ?? 'http://localhost:8080'),
  VITE_API_URL: runtime => runtime.endpoints.apiUrl ?? '',
  VITE_WEB_URL: runtime => runtime.endpoints.webUrl ?? '',
  VITE_APP_URL: runtime => runtime.endpoints.appUrl ?? '',
  VITE_WEBSITE_TITLE: runtime =>
    runtime.branding.websiteTitle ?? 'Control Centre',
  VITE_THEME: runtime => runtime.branding.theme ?? 'default',
  VITE_CLUSTER_ADMIN_GROUP_NAME: runtime =>
    runtime.branding.clusterAdminGroupName ?? 'cluster-admin',
  VITE_NOTEBOOK_NAME: runtime =>
    runtime.notebookAndRecordUX.notebookName ?? 'notebook',
  VITE_NOTEBOOK_LIST_TYPE: runtime =>
    runtime.notebookAndRecordUX.notebookListType ?? 'tabs',
  VITE_APP_ID: runtime => runtime.android.appId ?? 'org.fedarch.faims3',
  // Heading falls back to the app name.
  VITE_HEADING_APP_NAME: runtime =>
    runtime.branding.headingAppName ?? runtime.branding.appName ?? '',
  VITE_APP_PRIVACY_POLICY_URL: runtime =>
    runtime.support.privacyPolicyUrl ?? '',
  VITE_SUPPORT_EMAIL: runtime => runtime.support.supportEmail ?? '',
  VITE_APP_CONTACT_URL: runtime => runtime.support.appContactUrl ?? '',
  VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: runtime =>
    runtime.sync.syncPushOnlyRecordThreshold ??
    SHARED_DEFAULTS.syncPushOnlyRecordThreshold,
  VITE_TOKEN_REFRESH_INTERVAL_MS: runtime =>
    runtime.authTokens.tokenRefreshIntervalMs ??
    SHARED_DEFAULTS.tokenRefreshIntervalMs,
  VITE_TOKEN_REFRESH_WINDOW_MS: runtime =>
    runtime.authTokens.tokenRefreshWindowMs ??
    SHARED_DEFAULTS.tokenRefreshWindowMs,
  VITE_LOGIN_BANNER_GRACE_MS: runtime =>
    runtime.authTokens.loginBannerGraceMs ?? SHARED_DEFAULTS.loginBannerGraceMs,
  VITE_IGNORE_TOKEN_EXP: runtime => runtime.authTokens.ignoreTokenExp ?? false,
  VITE_NAVIGATION: runtime => runtime.notebookAndRecordUX.navigation ?? 'none',
  VITE_ATTACHMENT_SERVICE_TYPE: runtime =>
    runtime.attachments.attachmentServiceType ?? 'COUCH',
  VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: runtime =>
    runtime.attachments.attachmentDocumentIdPrefix ?? '',
  VITE_MAP_SOURCE: runtime => runtime.maps.mapSource ?? 'maptiler',
  VITE_MAP_SOURCE_KEY: runtime => runtime.maps.mapSourceKey ?? '',
  VITE_SATELLITE_SOURCE: runtime => runtime.maps.satelliteSource ?? '',
  VITE_MAP_STYLE: runtime => runtime.maps.mapStyle ?? 'basic',
  VITE_OFFLINE_MAPS: runtime => runtime.maps.offlineMaps ?? true,
  VITE_AUTOSUGGEST_SOURCE: runtime => runtime.maps.autosuggestSource ?? 'none',
  VITE_AUTOSUGGEST_MAPBOX_KEY: runtime =>
    runtime.maps.autosuggestMapboxKey ?? '',
  VITE_AUTOSUGGEST_MAPTILER_KEY: runtime =>
    runtime.maps.autosuggestMapTilerKey ?? '',
  VITE_MAPBOX_ADDRESS_COUNTRY: runtime =>
    runtime.maps.mapboxAddressCountry ?? 'AU',
  VITE_MAPTILER_ADDRESS_COUNTRY: runtime =>
    runtime.maps.maptilerAddressCountry ?? 'AU',
  VITE_MIGRATE_OLD_DATABASES: runtime =>
    runtime.migration.migrateOldDatabases ?? false,
  VITE_FORCE_REMOTE_DELETION: runtime =>
    runtime.sync.forceRemoteDeletion ?? 'never',
  VITE_DELETE_ON_DEACTIVATION: runtime =>
    runtime.sync.deleteOnDeactivation ?? false,
  VITE_BUGSNAG_KEY: runtime => runtime.observability.bugsnagApiKey ?? '',
  VITE_SHOW_WIPE: runtime => runtime.dev.showWipe ?? true,
  VITE_SHOW_POUCHDB_BROWSER: runtime => runtime.dev.showPouchDbBrowser ?? true,
  VITE_SHOW_STATUS_TAB: runtime =>
    runtime.notebookAndRecordUX.showStatusTab ?? true,
  VITE_SHOW_NEW_NOTEBOOK: runtime =>
    runtime.notebookAndRecordUX.showNewNotebook ?? true,
  VITE_SHOW_RECORD_SUMMARY_COUNTS: runtime =>
    runtime.notebookAndRecordUX.showRecordSummaryCounts ?? true,
  VITE_DEBUG_APP: runtime => runtime.dev.debugApp ?? false,
  VITE_DEBUG_POUCHDB: runtime => runtime.dev.debugPouchDb ?? false,
  VITE_POUCH_BATCH_SIZE: runtime =>
    runtime.pouchdb.pouchBatchSize ?? SHARED_DEFAULTS.pouchBatchSize,
  VITE_POUCH_BATCHES_LIMIT: runtime =>
    runtime.pouchdb.pouchBatchesLimit ?? SHARED_DEFAULTS.pouchBatchesLimit,
  VITE_DEVELOPER_MODE: runtime => runtime.dev.developerMode ?? false,
  VITE_DOCS_URL: runtime => runtime.support.docsUrl ?? '',
  VITE_MAX_DESIGN_FILE_SIZE_MB: runtime =>
    runtime.webDesignerLimits.maxDesignFileSizeMb ??
    SHARED_DEFAULTS.maxDesignFileSizeMb,
  VITE_TEMPLATE_PROTECTIONS: runtime =>
    runtime.webDesignerLimits.templateProtections ?? false,
  VITE_ENABLE_PLANS_IN_DESIGNER: runtime =>
    runtime.webDesignerLimits.enablePlansInDesigner ?? true,
  VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.authTokens.maximumLongLivedDurationDays ??
    SHARED_DEFAULTS.maximumLongLivedDurationDays,
  VITE_LONG_LIVED_TOKEN_DURATION_HINTS: runtime =>
    runtime.authTokens.longLivedTokenDurationHints ?? [
      ...DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
    ],
  VITE_EXCLUDED_TEAM_ROLES: runtime =>
    runtime.teamAndRolePolicy.excludedTeamRoles ?? [],
};

const androidContract: Record<string, EnvResolver> = {
  ANDROID_RELEASE_STATUS: runtime => runtime.android.releaseStatus ?? 'draft',
  APP_ID: runtime => runtime.android.appId ?? 'org.fedarch.faims3',
  KEYSTORE_FILE: runtime => runtime.android.keystoreFileBase64 ?? '',
  GPLAY_SERVICE_ACCOUNT_KEY_JSON: runtime =>
    runtime.android.serviceAccountKeyJsonBase64 ?? '',
  JAVA_KEYSTORE_PASSWORD: runtime => runtime.android.keystorePassword ?? '',
  JAVA_KEY: runtime => runtime.android.keyAlias ?? '',
  JAVA_KEY_PASSWORD: runtime => runtime.android.keyPassword ?? '',
};

const iosContract: Record<string, EnvResolver> = {
  VITE_APPLE_BUNDLE_IDENTIFIER: runtime =>
    runtime.ios.bundleIdentifier ??
    runtime.android.appId ??
    'org.fedarch.faims3',
  VITE_APP_STORE_CONNECT_TEAM_ID: runtime =>
    runtime.ios.appStoreConnectTeamId ?? '',
  FASTLANE_APPLE_ID: runtime => runtime.ios.appleId ?? '',
  FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: runtime =>
    runtime.ios.appleApplicationSpecificPassword ?? '',
  MATCH_PASSWORD: runtime => runtime.ios.matchPassword ?? '',
  MATCH_GIT_URL: runtime => runtime.ios.matchGitUrl ?? '',
  GIT_AUTHORIZATION: runtime => runtime.ios.gitAuthorization ?? '',
  PROVISIONING_PROFILE_SPECIFIER: runtime =>
    runtime.ios.provisioningProfileSpecifier ?? '',
  APPLE_KEY_ID: runtime =>
    runtime.ios.appleKeyId ?? runtime.ios.appleIndividualKeyId ?? '',
  APPLE_ISSUER_ID: runtime => runtime.ios.appleIssuerId ?? '',
  APPLE_KEY_CONTENT: runtime =>
    runtime.ios.appleKeyContent ?? runtime.ios.appleIndividualKeyContent ?? '',
};

const apiContract: Record<string, EnvResolver> = {
  PROFILE_NAME: runtime => runtime.auth.profileName ?? 'local-dev',
  KEY_FILE_PATH: runtime => runtime.auth.keyFilePath ?? '.',
  CONDUCTOR_INSTANCE_NAME: runtime =>
    runtime.branding.conductorInstanceName ?? 'Development FAIMS Server',
  CONDUCTOR_DESCRIPTION: runtime =>
    runtime.branding.conductorDescription ?? 'Development server on localhost',
  CONDUCTOR_SHORT_CODE_PREFIX: runtime =>
    runtime.branding.conductorShortCodePrefix ?? 'DEV',
  COUCHDB_USER: runtime => runtime.couchdb.user ?? 'admin',
  COUCHDB_PASSWORD: runtime => runtime.couchdb.password ?? '',
  COUCHDB_EXTERNAL_PORT: runtime =>
    runtime.couchdb.externalPort ?? SHARED_DEFAULTS.couchdbExternalPort,
  COUCHDB_INTERNAL_URL: runtime =>
    runtime.endpoints.couchdbInternalUrl ?? 'http://localhost:5984',
  COUCHDB_PUBLIC_URL: runtime =>
    runtime.endpoints.couchdbPublicUrl ?? 'http://localhost:5984',
  CONDUCTOR_EXTERNAL_PORT: runtime =>
    runtime.conductor.externalPort ?? SHARED_DEFAULTS.conductorExternalPort,
  CONDUCTOR_INTERNAL_PORT: runtime =>
    runtime.conductor.internalPort ?? SHARED_DEFAULTS.conductorInternalPort,
  CONDUCTOR_PUBLIC_URL: runtime =>
    runtime.endpoints.apiUrl ?? 'http://localhost:8080',
  WEB_APP_PUBLIC_URL: runtime =>
    runtime.endpoints.appUrl ?? 'http://localhost:3000',
  ANDROID_APP_PUBLIC_URL: runtime =>
    runtime.endpoints.androidAppPublicUrl ?? '',
  IOS_APP_PUBLIC_URL: runtime => runtime.endpoints.iosAppPublicUrl ?? '',
  FAIMS_COOKIE_SECRET: runtime => runtime.auth.cookieSecret ?? '',
  KEY_SOURCE: runtime => runtime.auth.keySource ?? 'FILE',
  AWS_SECRET_KEY_ARN: runtime => runtime.auth.awsSecretKeyArn ?? '',
  REFRESH_TOKEN_EXPIRY_MINUTES: runtime =>
    runtime.authTokens.refreshTokenExpiryMinutes ??
    SHARED_DEFAULTS.refreshTokenExpiryMinutes,
  ACCESS_TOKEN_EXPIRY_MINUTES: runtime =>
    runtime.authTokens.accessTokenExpiryMinutes ??
    SHARED_DEFAULTS.accessTokenExpiryMinutes,
  IMPERSONATION_SESSION_EXPIRY_MINUTES: runtime =>
    runtime.authTokens.impersonationSessionExpiryMinutes ??
    SHARED_DEFAULTS.impersonationSessionExpiryMinutes,
  EMAIL_CODE_EXPIRY_MINUTES: runtime =>
    runtime.authTokens.emailCodeExpiryMinutes ??
    SHARED_DEFAULTS.emailCodeExpiryMinutes,
  DISABLE_MIGRATE_ON_STARTUP: runtime =>
    runtime.migration.disableMigrateOnStartup ?? false,
  STARTUP_MIGRATION_LOCK_ENABLED: runtime =>
    runtime.migration.startupMigrationLockEnabled ?? false,
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS: runtime =>
    runtime.migration.startupMigrationLockTimeoutMs ??
    SHARED_DEFAULTS.startupMigrationLockTimeoutMs,
  DEVELOPER_MODE: runtime => runtime.dev.developerMode ?? false,
  DISABLE_LOCAL_LOGIN: runtime => runtime.auth.disableLocalLogin ?? false,
  PROVISION_SSO_USERS_POLICY: runtime =>
    runtime.auth.provisionSsoUsersPolicy ?? 'reject',
  RATE_LIMITER_WINDOW_MS: runtime =>
    runtime.limits.rateLimiterWindowMs ?? SHARED_DEFAULTS.rateLimiterWindowMs,
  RATE_LIMITER_PER_WINDOW: runtime =>
    runtime.limits.rateLimiterPerWindow ?? SHARED_DEFAULTS.rateLimiterPerWindow,
  RATE_LIMITER_ENABLED: runtime => runtime.limits.rateLimiterEnabled ?? true,
  EXPORT_RATE_LIMITER_ENABLED: runtime =>
    runtime.limits.exportRateLimiterEnabled ?? true,
  EXPORT_RATE_LIMITER_WINDOW_MS: runtime =>
    runtime.limits.exportRateLimiterWindowMs ??
    SHARED_DEFAULTS.exportRateLimiterWindowMs,
  EXPORT_RATE_LIMITER_PER_WINDOW: runtime =>
    runtime.limits.exportRateLimiterPerWindow ??
    SHARED_DEFAULTS.exportRateLimiterPerWindow,
  ATTEMPT_LIMITER_ENABLED: runtime =>
    runtime.limits.attemptLimiterEnabled ?? true,
  REDIRECT_WHITELIST: runtime => runtime.endpoints.redirectWhitelist ?? [],
  EMAIL_SERVICE_TYPE: runtime => runtime.email.emailServiceType ?? 'MOCK',
  EMAIL_FROM_ADDRESS: runtime =>
    runtime.email.emailFromAddress ?? 'notifications@example.com',
  EMAIL_FROM_NAME: runtime =>
    runtime.email.emailFromName ?? 'FAIMS Notification',
  EMAIL_REPLY_TO: runtime =>
    runtime.email.emailReplyTo ?? 'support@example.com',
  SMTP_HOST: runtime => runtime.email.smtpHost ?? '',
  SMTP_PORT: runtime => runtime.email.smtpPort ?? SHARED_DEFAULTS.smtpPort,
  SMTP_SECURE: runtime => runtime.email.smtpSecure ?? false,
  SMTP_USER: runtime => runtime.email.smtpUser ?? '',
  SMTP_PASSWORD: runtime => runtime.email.smtpPassword ?? '',
  SMTP_CACHE_EXPIRY_SECONDS: runtime =>
    runtime.email.smtpCacheExpirySeconds ??
    SHARED_DEFAULTS.smtpCacheExpirySeconds,
  TEST_EMAIL_ADDRESS: runtime => runtime.email.testEmailAddress ?? '',
  MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.authTokens.maximumLongLivedDurationDays ??
    SHARED_DEFAULTS.maximumLongLivedDurationDays,
  BUGSNAG_API_KEY: runtime => runtime.observability.bugsnagApiKey ?? '',
  JSON_BODY_LIMIT: runtime =>
    runtime.limits.jsonBodyLimit ?? SHARED_DEFAULTS.jsonBodyLimit,
  URLENCODED_BODY_LIMIT: runtime =>
    runtime.limits.urlencodedBodyLimit ?? SHARED_DEFAULTS.urlencodedBodyLimit,
  RESTORE_UPLOAD_MAX_BYTES: runtime =>
    runtime.limits.restoreUploadMaxBytes ??
    SHARED_DEFAULTS.restoreUploadMaxBytes,
  DOWNLOAD_COOKIE_SAMESITE: runtime =>
    runtime.limits.downloadCookieSameSite ?? 'lax',
  RECORDS_HYDRATED_PAGE_LIMIT: runtime =>
    runtime.limits.recordsHydratedPageLimit ??
    SHARED_DEFAULTS.recordsHydratedPageLimit,
  MEMORY_MONITOR_ENABLED: runtime =>
    runtime.observability.memoryMonitorEnabled ?? false,
  REQUEST_LOGGING_ENABLED: runtime =>
    runtime.observability.requestLoggingEnabled ?? true,
  ATTACHMENT_STORAGE_TYPE: runtime =>
    runtime.attachmentStorage.serviceType ?? 'S3',
  ATTACHMENT_S3_BUCKET: runtime =>
    runtime.attachmentStorage.bucket ?? SHARED_DEFAULTS.attachmentS3Bucket,
  ATTACHMENT_S3_PREFIX: runtime =>
    runtime.attachmentStorage.prefix ?? SHARED_DEFAULTS.attachmentS3Prefix,
  ATTACHMENT_S3_REGION: runtime =>
    runtime.attachmentStorage.region ?? SHARED_DEFAULTS.attachmentS3Region,
  ATTACHMENT_S3_ENDPOINT: runtime => runtime.attachmentStorage.endpoint,
  ATTACHMENT_S3_PUBLIC_ENDPOINT: runtime =>
    runtime.attachmentStorage.publicEndpoint,
  ATTACHMENT_S3_FORCE_PATH_STYLE: runtime =>
    runtime.attachmentStorage.forcePathStyle,
  ATTACHMENT_S3_ACCESS_KEY_ID: runtime => runtime.attachmentStorage.accessKeyId,
  ATTACHMENT_S3_SECRET_ACCESS_KEY: runtime =>
    runtime.attachmentStorage.secretAccessKey,
  CAPACITY_PROVIDER: runtime => runtime.spatialCapacity.provider ?? 'FIXED',
  CAPACITY_MAX: runtime =>
    runtime.spatialCapacity.maxCapacity ?? SHARED_DEFAULTS.capacityMax,
  CAPACITY_SCALE_THRESHOLDS: runtime =>
    runtime.spatialCapacity.scaleThresholds ?? [
      ...SHARED_DEFAULTS.capacityScaleThresholds,
    ],
  CAPACITY_RECONCILE_MS: runtime =>
    runtime.spatialCapacity.reconcileMs ?? SHARED_DEFAULTS.capacityReconcileMs,
  CAPACITY_STARVATION_MS: runtime =>
    runtime.spatialCapacity.starvationMs ??
    SHARED_DEFAULTS.capacityStarvationMs,
  CAPACITY_SCALE_IN_COOLDOWN_MS: runtime =>
    runtime.spatialCapacity.scaleInCooldownMs,
  CAPACITY_FIXED_REPLICAS: runtime =>
    runtime.spatialCapacity.fixedReplicas ??
    SHARED_DEFAULTS.capacityFixedReplicas,
  SPATIAL_WORKER_IDLE_EXIT_MS: runtime =>
    runtime.spatialCapacity.idleExitMs ??
    SHARED_DEFAULTS.spatialWorkerIdleExitMs,
  SPATIAL_WORKER_POLL_MS: runtime =>
    runtime.spatialCapacity.pollMs ?? SHARED_DEFAULTS.spatialWorkerPollMs,
  GDAL_NUM_THREADS: runtime =>
    String(
      runtime.spatialCapacity.gdalNumThreads ?? SHARED_DEFAULTS.gdalNumThreads
    ),
  GDAL_CACHEMAX: runtime =>
    runtime.spatialCapacity.gdalCacheMaxMb ?? SHARED_DEFAULTS.gdalCacheMaxMb,
  GDAL_WARP_MEMORY_MB: runtime =>
    runtime.spatialCapacity.gdalWarpMemoryMb ??
    SHARED_DEFAULTS.gdalWarpMemoryMb,
  GDAL_WARP_MULTI: runtime =>
    runtime.spatialCapacity.gdalWarpMulti ?? SHARED_DEFAULTS.gdalWarpMulti,
  TIPPECANOE_MAX_THREADS: runtime =>
    runtime.spatialCapacity.tippecanoeMaxThreads,
};

function applyContract(
  contract: Record<string, EnvResolver>,
  runtime: RuntimeConfig,
  target: Record<string, EnvValue>
) {
  for (const [key, resolve] of Object.entries(contract)) {
    target[key] = resolve(runtime);
  }
}

/** Build the platform env map for a runtime config via the env contract. */
export function buildEnvMapFromRuntime(
  runtime: RuntimeConfig,
  platform: SupportedPlatform,
  options: {includeEmpty?: boolean} = {}
): Record<string, EnvValue> {
  const {includeEmpty = false} = options;
  const map: Record<string, EnvValue> = {};

  if (platform === 'apps' || platform === 'all') {
    applyContract(baseContract, runtime, map);
    applyContract(androidContract, runtime, map);
    applyContract(iosContract, runtime, map);
  }

  if (platform === 'api' || platform === 'all') {
    applyContract(apiContract, runtime, map);
    for (const [key, value] of Object.entries(
      buildAuthProviderEnvMap(runtime.authProviders)
    )) {
      map[key] = value;
    }
  }

  if (includeEmpty) {
    for (const [key, value] of Object.entries(map)) {
      if (value === undefined || value === null) {
        map[key] = '';
      }
    }
  }

  return map;
}

/**
 * Build a string-valued env map for a runtime config via the env contract,
 * omitting `undefined` and `null` entries.
 */
export function buildStringEnvMapFromRuntime(
  runtime: RuntimeConfig,
  platform: SupportedPlatform
): Record<string, string> {
  const raw = buildEnvMapFromRuntime(runtime, platform);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const str = envValueToString(value);
    if (str !== undefined) env[key] = str;
  }
  return env;
}
