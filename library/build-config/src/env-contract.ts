import {RuntimeConfig} from './build-config';
import {buildAuthProviderEnvMap} from './auth-provider-config';

type SupportedPlatform = 'apps' | 'api';

type EnvValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

type EnvResolver = (runtime: RuntimeConfig) => EnvValue;

const baseContract: Record<string, EnvResolver> = {
  VITE_APP_NAME: runtime => runtime.branding.appName ?? '',
  VITE_APP_SHORT_NAME: runtime => runtime.branding.appShortName ?? '',
  VITE_CLUSTER_ADMIN_GROUP_NAME: runtime =>
    runtime.auth.clusterAdminGroupName ?? 'cluster-admin',
  VITE_COMMIT_VERSION: runtime => runtime.observability.commitVersion ?? 'local-build',
  VITE_CONDUCTOR_URL: runtime => runtime.endpoints.apiUrl ?? '',
  VITE_API_URL: runtime => runtime.endpoints.apiUrl ?? '',
  VITE_WEB_URL: runtime => runtime.endpoints.webUrl ?? '',
  VITE_APP_URL: runtime => runtime.endpoints.appUrl ?? '',
  VITE_WEBSITE_TITLE: runtime => runtime.branding.websiteTitle ?? 'Control Centre',
  VITE_APP_THEME: runtime => runtime.branding.theme ?? 'default',
  VITE_THEME: runtime => runtime.branding.theme ?? 'default',
  VITE_NOTEBOOK_NAME: runtime => runtime.notebookAndRecordUX.notebookName ?? 'notebook',
  VITE_NOTEBOOK_LIST_TYPE: runtime => runtime.notebookAndRecordUX.notebookListType ?? 'tabs',
  VITE_APP_ID: runtime => runtime.android.appId ?? 'org.fedarch.faims3',
  VITE_HEADING_APP_NAME: runtime => runtime.branding.headingAppName ?? runtime.branding.appName ?? '',
  VITE_APP_PRIVACY_POLICY_URL: runtime => runtime.support.privacyPolicyUrl ?? '',
  VITE_SUPPORT_EMAIL: runtime => runtime.support.supportEmail ?? '',
  VITE_APP_CONTACT_URL: runtime => runtime.support.appContactUrl ?? '',
  VITE_DIRECTORY_USERNAME: runtime => runtime.auth.directoryUsername ?? '',
  VITE_DIRECTORY_PASSWORD: runtime => runtime.auth.directoryPassword ?? '',
  VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: runtime =>
    runtime.sync.syncPushOnlyRecordThreshold ?? 500,
  VITE_TOKEN_REFRESH_INTERVAL_MS: runtime => runtime.authTokens.tokenRefreshIntervalMs ?? 15000,
  VITE_TOKEN_REFRESH_WINDOW_MS: runtime => runtime.authTokens.tokenRefreshWindowMs ?? 60000,
  VITE_LOGIN_BANNER_GRACE_MS: runtime => runtime.authTokens.loginBannerGraceMs ?? 10000,
  VITE_IGNORE_TOKEN_EXP: runtime => runtime.authTokens.ignoreTokenExp ?? false,
  VITE_NAVIGATION: runtime => runtime.notebookAndRecordUX.navigation ?? 'none',
  VITE_SHOW_RECORD_LINKS: runtime => runtime.notebookAndRecordUX.showRecordLinks ?? false,
  VITE_ATTACHMENT_SERVICE_TYPE: runtime => runtime.attachments.attachmentServiceType ?? 'COUCH',
  VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: runtime =>
    runtime.attachments.attachmentDocumentIdPrefix ?? '',
  VITE_APPLE_BUNDLE_IDENTIFIER: runtime =>
    runtime.ios.bundleIdentifier ?? runtime.android.appId ?? 'org.fedarch.faims3',
  VITE_APP_STORE_CONNECT_TEAM_ID: runtime =>
    runtime.ios.appStoreConnectTeamId ?? '',
  VITE_MAP_SOURCE: runtime => runtime.maps.mapSource ?? 'maptiler',
  VITE_MAP_SOURCE_KEY: runtime => runtime.maps.mapSourceKey ?? '',
  VITE_SATELLITE_SOURCE: runtime => runtime.maps.satelliteSource ?? '',
  VITE_MAP_STYLE: runtime => runtime.maps.mapStyle ?? 'basic',
  VITE_OFFLINE_MAPS: runtime => runtime.maps.offlineMaps ?? true,
  VITE_AUTOSUGGEST_SOURCE: runtime => runtime.maps.autosuggestSource ?? 'NONE',
  VITE_AUTOSUGGEST_MAPBOX_KEY: runtime => runtime.maps.autosuggestMapboxKey ?? '',
  VITE_AUTOSUGGEST_MAPTILER_KEY: runtime => runtime.maps.autosuggestMapTilerKey ?? '',
  VITE_MAPBOX_ADDRESS_COUNTRY: runtime =>
    runtime.maps.mapboxAddressCountry ?? 'AU',
  VITE_MAPTILER_ADDRESS_COUNTRY: runtime =>
    runtime.maps.maptilerAddressCountry ?? 'AU',
  VITE_MIGRATE_OLD_DATABASES: runtime => runtime.migration.migrateOldDatabases ?? false,
  VITE_FORCE_REMOTE_DELETION: runtime =>
    runtime.sync.forceRemoteDeletion ?? 'never',
  VITE_DELETE_ON_DEACTIVATION: runtime =>
    runtime.sync.deleteOnDeactivation ?? false,
  VITE_BUGSNAG_KEY: runtime => runtime.observability.bugsnagApiKey ?? '',
  VITE_SHOW_WIPE: runtime => runtime.dev.showWipe ?? true,
  VITE_SHOW_POUCHDB_BROWSER: runtime => runtime.dev.showPouchDbBrowser ?? true,
  VITE_SHOW_NEW_NOTEBOOK: runtime => runtime.notebookAndRecordUX.showNewNotebook ?? true,
  VITE_SHOW_STATUS_TAB: runtime => runtime.notebookAndRecordUX.showStatusTab ?? true,
  VITE_DEBUG_APP: runtime => runtime.dev.debugApp ?? false,
  VITE_DEBUG_POUCHDB: runtime => runtime.dev.debugPouchDb ?? false,
  VITE_POUCH_BATCH_SIZE: runtime => runtime.pouchdb.pouchBatchSize ?? 10,
  VITE_POUCH_BATCHES_LIMIT: runtime => runtime.pouchdb.pouchBatchesLimit ?? 10,
  VITE_DEVELOPER_MODE: runtime => runtime.dev.developerMode ?? false,
  VITE_DOCS_URL: runtime => runtime.support.docsUrl ?? '',
  VITE_BUGSNAG_API_KEY: runtime =>
    runtime.observability.bugsnagApiKey ?? '',
  VITE_MAX_DESIGN_FILE_SIZE_MB: runtime => runtime.webDesignerLimits.maxDesignFileSizeMb ?? 10,
  VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.authTokens.maximumLongLivedDurationDays ?? 90,
  VITE_LONG_LIVED_TOKEN_DURATION_HINTS: runtime =>
    runtime.authTokens.longLivedTokenDurationHints ?? [1, 5, 10, 30, 90, 365],
  VITE_EXCLUDED_TEAM_ROLES: runtime => runtime.teamAndRolePolicy.excludedTeamRoles ?? [],
};

const androidContract: Record<string, EnvResolver> = {
  ANDROID_RELEASE_STATUS: runtime =>
    runtime.android.releaseStatus ?? 'draft',
  APP_ID: runtime => runtime.android.appId ?? 'org.fedarch.faims3',
  KEYSTORE_FILE: runtime => runtime.android.keystoreFileBase64 ?? '',
  GPLAY_SERVICE_ACCOUNT_KEY_JSON: runtime =>
    runtime.android.serviceAccountKeyJsonBase64 ?? '',
  JAVA_KEYSTORE: runtime => runtime.android.keystorePath ?? '',
  JAVA_KEYSTORE_PASSWORD: runtime =>
    runtime.android.keystorePassword ?? '',
  JAVA_KEY: runtime => runtime.android.keyAlias ?? '',
  JAVA_KEY_PASSWORD: runtime => runtime.android.keyPassword ?? '',
  ANDROID_JSON_KEY_FILE: runtime =>
    runtime.android.serviceAccountJsonPath ?? '',
};

const iosContract: Record<string, EnvResolver> = {
  VITE_APPLE_BUNDLE_IDENTIFIER: runtime =>
    runtime.ios.bundleIdentifier ?? runtime.android.appId ?? 'org.fedarch.faims3',
  VITE_APP_STORE_CONNECT_TEAM_ID: runtime =>
    runtime.ios.appStoreConnectTeamId ?? '',
  FASTLANE_APPLE_ID: runtime => runtime.ios.appleId ?? '',
  FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: runtime =>
    runtime.ios.appleApplicationSpecificPassword ?? '',
  MATCH_PASSWORD: runtime => runtime.ios.matchPassword ?? '',
  GIT_AUTHORIZATION: runtime => runtime.ios.gitAuthorization ?? '',
  PROVISIONING_PROFILE_SPECIFIER: runtime =>
    runtime.ios.provisioningProfileSpecifier ?? '',
  APPLE_KEY_ID: runtime =>
    runtime.ios.appleKeyId ?? runtime.ios.appleIndividualKeyId ?? '',
  APPLE_ISSUER_ID: runtime => runtime.ios.appleIssuerId ?? '',
  APPLE_KEY_CONTENT: runtime =>
    runtime.ios.appleKeyContent ??
    runtime.ios.appleIndividualKeyContent ??
    '',
};

const apiContract: Record<string, EnvResolver> = {
  PROFILE_NAME: runtime => runtime.auth.profileName ?? 'local-dev',
  KEY_FILE_PATH: runtime => runtime.auth.keyFilePath ?? '.',
  CONDUCTOR_INSTANCE_NAME: runtime => runtime.branding.conductorInstanceName ?? 'Development FAIMS Server',
  CONDUCTOR_DESCRIPTION: runtime => runtime.branding.conductorDescription ?? 'Development server on localhost',
  CONDUCTOR_SHORT_CODE_PREFIX: runtime => runtime.branding.conductorShortCodePrefix ?? 'DEV',
  COUCHDB_USER: runtime => runtime.couchdb.couchdbUser ?? 'admin',
  COUCHDB_PASSWORD: runtime => runtime.couchdb.couchdbPassword ?? 'aSecretPasswordThatCantBeGuessed',
  COUCHDB_EXTERNAL_PORT: runtime => runtime.couchdb.couchdbExternalPort ?? 5984,
  COUCHDB_INTERNAL_URL: runtime => runtime.endpoints.couchdbInternalUrl ?? 'http://localhost:5984',
  COUCHDB_PUBLIC_URL: runtime => runtime.endpoints.couchdbPublicUrl ?? 'http://localhost:5984',
  CONDUCTOR_EXTERNAL_PORT: runtime => runtime.couchdb.conductorExternalPort ?? 8080,
  CONDUCTOR_INTERNAL_PORT: runtime => runtime.couchdb.conductorInternalPort ?? 8080,
  CONDUCTOR_PUBLIC_URL: runtime => runtime.endpoints.apiUrl ?? 'http://localhost:8080',
  WEB_APP_PUBLIC_URL: runtime => runtime.endpoints.webUrl ?? 'http://localhost:3001',
  ANDROID_APP_PUBLIC_URL: runtime => runtime.endpoints.androidAppPublicUrl ?? '',
  IOS_APP_PUBLIC_URL: runtime => runtime.endpoints.iosAppPublicUrl ?? '',
  FAIMS_COOKIE_SECRET: runtime => runtime.auth.cookieSecret ?? '',
  KEY_SOURCE: runtime => runtime.auth.keySource ?? 'FILE',
  AWS_SECRET_KEY_ARN: runtime => runtime.auth.awsSecretKeyArn ?? '',
  REFRESH_TOKEN_EXPIRY_MINUTES: runtime => runtime.authTokens.refreshTokenExpiryMinutes ?? 2880,
  ACCESS_TOKEN_EXPIRY_MINUTES: runtime => runtime.authTokens.accessTokenExpiryMinutes ?? 5,
  IMPERSONATION_SESSION_EXPIRY_MINUTES: runtime =>
    runtime.authTokens.impersonationSessionExpiryMinutes ?? 60,
  EMAIL_CODE_EXPIRY_MINUTES: runtime => runtime.authTokens.emailCodeExpiryMinutes ?? 30,
  DISABLE_MIGRATE_ON_STARTUP: runtime => runtime.migration.disableMigrateOnStartup ?? false,
  STARTUP_MIGRATION_LOCK_ENABLED: runtime =>
    runtime.migration.startupMigrationLockEnabled ?? false,
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS: runtime =>
    runtime.migration.startupMigrationLockTimeoutMs ?? 1800000,
  DEVELOPER_MODE: runtime => runtime.dev.developerMode ?? false,
  DISABLE_LOCAL_LOGIN: runtime => runtime.auth.disableLocalLogin ?? false,
  PROVISION_SSO_USERS_POLICY: runtime => runtime.auth.provisionSsoUsersPolicy ?? 'reject',
  RATE_LIMITER_WINDOW_MS: runtime => runtime.limits.rateLimiterWindowMs ?? 600000,
  RATE_LIMITER_PER_WINDOW: runtime => runtime.limits.rateLimiterPerWindow ?? 1000,
  RATE_LIMITER_ENABLED: runtime => runtime.limits.rateLimiterEnabled ?? true,
  EXPORT_RATE_LIMITER_ENABLED: runtime => runtime.limits.exportRateLimiterEnabled ?? true,
  EXPORT_RATE_LIMITER_WINDOW_MS: runtime => runtime.limits.exportRateLimiterWindowMs ?? 600000,
  EXPORT_RATE_LIMITER_PER_WINDOW: runtime => runtime.limits.exportRateLimiterPerWindow ?? 20,
  ATTEMPT_LIMITER_ENABLED: runtime => runtime.limits.attemptLimiterEnabled ?? true,
  NEW_CONDUCTOR_URL: runtime => runtime.endpoints.webUrl ?? 'http://localhost:3001',
  REDIRECT_WHITELIST: runtime => runtime.endpoints.redirectWhitelist ?? [],
  EMAIL_SERVICE_TYPE: runtime => runtime.email.emailServiceType ?? 'MOCK',
  EMAIL_FROM_ADDRESS: runtime => runtime.email.emailFromAddress ?? 'notifications@example.com',
  EMAIL_FROM_NAME: runtime => runtime.email.emailFromName ?? 'FAIMS Notification',
  EMAIL_REPLY_TO: runtime => runtime.email.emailReplyTo ?? 'support@example.com',
  SMTP_HOST: runtime => runtime.email.smtpHost ?? 'smtp.example.com',
  SMTP_PORT: runtime => runtime.email.smtpPort ?? 587,
  SMTP_SECURE: runtime => runtime.email.smtpSecure ?? true,
  SMTP_USER: runtime => runtime.email.smtpUser ?? 'smtp_username',
  SMTP_PASSWORD: runtime => runtime.email.smtpPassword ?? 'smtp_password',
  SMTP_CACHE_EXPIRY_SECONDS: runtime => runtime.email.smtpCacheExpirySeconds ?? 300,
  TEST_EMAIL_ADDRESS: runtime => runtime.email.testEmailAddress ?? 'test@gmail.com',
  MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.authTokens.maximumLongLivedDurationDays ?? 90,
  BUGSNAG_API_KEY: runtime => runtime.observability.bugsnagApiKey ?? '',
  JSON_BODY_LIMIT: runtime => runtime.limits.jsonBodyLimit ?? '25mb',
  URLENCODED_BODY_LIMIT: runtime => runtime.limits.urlencodedBodyLimit ?? '1mb',
  RESTORE_UPLOAD_MAX_BYTES: runtime => runtime.limits.restoreUploadMaxBytes ?? 1073741824,
  DOWNLOAD_COOKIE_SAMESITE: runtime => runtime.limits.downloadCookieSameSite ?? 'lax',
  RECORDS_HYDRATED_PAGE_LIMIT: runtime => runtime.limits.recordsHydratedPageLimit ?? 150,
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

export function buildEnvMapFromRuntime(
  runtime: RuntimeConfig,
  platform: SupportedPlatform,
  options: {includeEmpty?: boolean} = {}
): Record<string, EnvValue> {
  const {includeEmpty = false} = options;
  const map: Record<string, EnvValue> = {};

  if (platform === 'apps') {
    applyContract(baseContract, runtime, map);
    applyContract(androidContract, runtime, map);
    applyContract(iosContract, runtime, map);
  }

  if (platform === 'api') {
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
