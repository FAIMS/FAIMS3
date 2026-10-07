import {RuntimeConfig} from './build-config.js';
import {buildAuthProviderEnvMap} from './auth-provider-config.js';

type SupportedPlatform = 'all' | 'android' | 'ios' | 'web' | 'api';

type EnvValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

type EnvResolver = (runtime: RuntimeConfig) => EnvValue;

const baseContract: Record<string, EnvResolver> = {
  VITE_APP_NAME: runtime => runtime.shared.branding.appName,
  VITE_APP_SHORT_NAME: runtime => runtime.shared.branding.appShortName,
  VITE_CLUSTER_ADMIN_GROUP_NAME: runtime =>
    runtime.shared.branding.clusterAdminGroupName,
  VITE_COMMIT_VERSION: runtime => runtime.shared.observability.commitVersion,
  VITE_CONDUCTOR_URL: runtime => runtime.shared.urls.api,
  VITE_API_URL: runtime => runtime.shared.urls.api,
  VITE_WEB_URL: runtime => runtime.shared.urls.web,
  VITE_APP_URL: runtime => runtime.shared.urls.app,
  VITE_WEBSITE_TITLE: runtime => runtime.web.websiteTitle,
  VITE_APP_THEME: runtime => runtime.shared.branding.theme,
  VITE_THEME: runtime => runtime.shared.branding.theme,
  VITE_NOTEBOOK_NAME: runtime => runtime.shared.notebook.name,
  VITE_NOTEBOOK_LIST_TYPE: runtime => runtime.shared.notebook.listType,
  VITE_APP_ID: runtime => runtime.shared.branding.appId,
  VITE_HEADING_APP_NAME: runtime => runtime.shared.branding.headingAppName,
  VITE_APP_PRIVACY_POLICY_URL: runtime => runtime.shared.support.privacyPolicyUrl,
  VITE_SUPPORT_EMAIL: runtime => runtime.shared.support.supportEmail,
  VITE_APP_CONTACT_URL: runtime => runtime.shared.support.contactUrl,
  VITE_DIRECTORY_USERNAME: runtime => runtime.app.directoryUsername ?? '',
  VITE_DIRECTORY_PASSWORD: runtime => runtime.app.directoryPassword ?? '',
  VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: runtime =>
    runtime.app.syncPushOnlyRecordThreshold,
  VITE_TOKEN_REFRESH_INTERVAL_MS: runtime => runtime.app.tokenRefreshIntervalMs,
  VITE_TOKEN_REFRESH_WINDOW_MS: runtime => runtime.app.tokenRefreshWindowMs,
  VITE_LOGIN_BANNER_GRACE_MS: runtime => runtime.app.loginBannerGraceMs,
  VITE_IGNORE_TOKEN_EXP: runtime => runtime.app.ignoreTokenExp,
  VITE_NAVIGATION: runtime => runtime.app.navigation,
  VITE_SHOW_RECORD_LINKS: runtime => runtime.app.showRecordLinks,
  VITE_ATTACHMENT_SERVICE_TYPE: runtime => runtime.app.attachmentServiceType,
  VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: runtime =>
    runtime.app.attachmentDocumentIdPrefix ?? '',
  VITE_APPLE_BUNDLE_IDENTIFIER: runtime =>
    runtime.mobile.ios.bundleIdentifier ?? runtime.shared.branding.appId,
  VITE_APP_STORE_CONNECT_TEAM_ID: runtime =>
    runtime.mobile.ios.appStoreConnectTeamId ?? '',
  VITE_MAP_SOURCE: runtime => runtime.shared.maps.source,
  VITE_MAP_SOURCE_KEY: runtime => runtime.shared.maps.sourceKey,
  VITE_SATELLITE_SOURCE: runtime => runtime.shared.maps.satelliteSource ?? '',
  VITE_MAP_STYLE: runtime => runtime.shared.maps.style,
  VITE_OFFLINE_MAPS: runtime => runtime.shared.maps.offlineMaps,
  VITE_AUTOSUGGEST_SOURCE: runtime => runtime.app.autosuggest.source,
  VITE_AUTOSUGGEST_MAPBOX_KEY: runtime => runtime.app.autosuggest.mapboxKey,
  VITE_AUTOSUGGEST_MAPTILER_KEY: runtime => runtime.app.autosuggest.maptilerKey,
  VITE_MAPBOX_ADDRESS_COUNTRY: runtime =>
    runtime.app.autosuggest.mapboxAddressCountry,
  VITE_MAPTILER_ADDRESS_COUNTRY: runtime =>
    runtime.app.autosuggest.maptilerAddressCountry,
  VITE_MIGRATE_OLD_DATABASES: runtime => runtime.app.migrateOldDatabases,
  VITE_FORCE_REMOTE_DELETION: runtime =>
    runtime.shared.deletionPolicy.forceRemoteDeletion,
  VITE_DELETE_ON_DEACTIVATION: runtime =>
    runtime.shared.deletionPolicy.deleteOnDeactivation,
  VITE_BUGSNAG_KEY: runtime => runtime.shared.observability.bugsnagApiKey ?? '',
  VITE_SHOW_WIPE: runtime => runtime.app.showWipe,
  VITE_SHOW_POUCHDB_BROWSER: runtime => runtime.app.showPouchDbBrowser,
  VITE_SHOW_NEW_NOTEBOOK: runtime => runtime.app.showNewNotebook,
  VITE_SHOW_STATUS_TAB: runtime => runtime.app.showStatusTab,
  VITE_DEBUG_APP: runtime => runtime.app.debugApp,
  VITE_DEBUG_POUCHDB: runtime => runtime.app.debugPouchDb,
  VITE_POUCH_BATCH_SIZE: runtime => runtime.app.pouchBatchSize,
  VITE_POUCH_BATCHES_LIMIT: runtime => runtime.app.pouchBatchesLimit,
  VITE_DEVELOPER_MODE: runtime => runtime.app.developerMode,
  VITE_DOCS_URL: runtime => runtime.web.docsUrl,
  VITE_BUGSNAG_API_KEY: runtime =>
    runtime.shared.observability.bugsnagApiKey ?? '',
  VITE_MAX_DESIGN_FILE_SIZE_MB: runtime => runtime.web.maxDesignFileSizeMb,
  VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.web.maximumLongLivedDurationDays,
  VITE_LONG_LIVED_TOKEN_DURATION_HINTS: runtime =>
    runtime.web.longLivedTokenDurationHints,
  VITE_EXCLUDED_TEAM_ROLES: runtime => runtime.web.excludedTeamRoles,
};

const androidContract: Record<string, EnvResolver> = {
  ANDROID_RELEASE_STATUS: runtime =>
    runtime.mobile.android.releaseStatus ?? 'draft',
  APP_ID: runtime =>
    runtime.mobile.android.appId ?? runtime.shared.branding.appId,
  KEYSTORE_FILE: runtime => runtime.mobile.android.keystoreFileBase64 ?? '',
  GPLAY_SERVICE_ACCOUNT_KEY_JSON: runtime =>
    runtime.mobile.android.serviceAccountKeyJsonBase64 ?? '',
  JAVA_KEYSTORE: runtime => runtime.mobile.android.keystorePath ?? '',
  JAVA_KEYSTORE_PASSWORD: runtime =>
    runtime.mobile.android.keystorePassword ?? '',
  JAVA_KEY: runtime => runtime.mobile.android.keyAlias ?? '',
  JAVA_KEY_PASSWORD: runtime => runtime.mobile.android.keyPassword ?? '',
  ANDROID_JSON_KEY_FILE: runtime =>
    runtime.mobile.android.serviceAccountJsonPath ?? '',
};

const iosContract: Record<string, EnvResolver> = {
  VITE_APPLE_BUNDLE_IDENTIFIER: runtime =>
    runtime.mobile.ios.bundleIdentifier ?? runtime.shared.branding.appId,
  VITE_APP_STORE_CONNECT_TEAM_ID: runtime =>
    runtime.mobile.ios.appStoreConnectTeamId ?? '',
  FASTLANE_APPLE_ID: runtime => runtime.mobile.ios.appleId ?? '',
  FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: runtime =>
    runtime.mobile.ios.appleApplicationSpecificPassword ?? '',
  MATCH_PASSWORD: runtime => runtime.mobile.ios.matchPassword ?? '',
  GIT_AUTHORIZATION: runtime => runtime.mobile.ios.gitAuthorization ?? '',
  PROVISIONING_PROFILE_SPECIFIER: runtime =>
    runtime.mobile.ios.provisioningProfileSpecifier ?? '',
  APPLE_KEY_ID: runtime =>
    runtime.mobile.ios.appleKeyId ?? runtime.mobile.ios.appleIndividualKeyId ?? '',
  APPLE_ISSUER_ID: runtime => runtime.mobile.ios.appleIssuerId ?? '',
  APPLE_KEY_CONTENT: runtime =>
    runtime.mobile.ios.appleKeyContent ??
    runtime.mobile.ios.appleIndividualKeyContent ??
    '',
};

const apiContract: Record<string, EnvResolver> = {
  PROFILE_NAME: runtime => runtime.api.profileName,
  KEY_FILE_PATH: runtime => runtime.api.keyFilePath,
  CONDUCTOR_INSTANCE_NAME: runtime => runtime.api.conductorInstanceName,
  CONDUCTOR_DESCRIPTION: runtime => runtime.api.conductorDescription,
  CONDUCTOR_SHORT_CODE_PREFIX: runtime => runtime.api.conductorShortCodePrefix,
  COUCHDB_USER: runtime => runtime.api.couchdbUser,
  COUCHDB_PASSWORD: runtime => runtime.api.couchdbPassword,
  COUCHDB_EXTERNAL_PORT: runtime => runtime.api.couchdbExternalPort,
  COUCHDB_INTERNAL_URL: runtime => runtime.api.couchdbInternalUrl,
  COUCHDB_PUBLIC_URL: runtime => runtime.api.couchdbPublicUrl,
  CONDUCTOR_EXTERNAL_PORT: runtime => runtime.api.conductorExternalPort,
  CONDUCTOR_INTERNAL_PORT: runtime => runtime.api.conductorInternalPort,
  CONDUCTOR_PUBLIC_URL: runtime => runtime.api.conductorPublicUrl,
  WEB_APP_PUBLIC_URL: runtime => runtime.api.webAppPublicUrl,
  ANDROID_APP_PUBLIC_URL: runtime => runtime.api.androidAppPublicUrl,
  IOS_APP_PUBLIC_URL: runtime => runtime.api.iosAppPublicUrl,
  FAIMS_COOKIE_SECRET: runtime => runtime.api.cookieSecret,
  KEY_SOURCE: runtime => runtime.api.keySource,
  AWS_SECRET_KEY_ARN: runtime => runtime.api.awsSecretKeyArn ?? '',
  REFRESH_TOKEN_EXPIRY_MINUTES: runtime => runtime.api.refreshTokenExpiryMinutes,
  ACCESS_TOKEN_EXPIRY_MINUTES: runtime => runtime.api.accessTokenExpiryMinutes,
  IMPERSONATION_SESSION_EXPIRY_MINUTES: runtime =>
    runtime.api.impersonationSessionExpiryMinutes,
  EMAIL_CODE_EXPIRY_MINUTES: runtime => runtime.api.emailCodeExpiryMinutes,
  DISABLE_MIGRATE_ON_STARTUP: runtime => runtime.api.disableMigrateOnStartup,
  STARTUP_MIGRATION_LOCK_ENABLED: runtime =>
    runtime.api.startupMigrationLockEnabled,
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS: runtime =>
    runtime.api.startupMigrationLockTimeoutMs,
  DEVELOPER_MODE: runtime => runtime.api.developerMode,
  DISABLE_LOCAL_LOGIN: runtime => runtime.api.disableLocalLogin,
  PROVISION_SSO_USERS_POLICY: runtime => runtime.api.provisionSsoUsersPolicy,
  RATE_LIMITER_WINDOW_MS: runtime => runtime.api.rateLimiterWindowMs,
  RATE_LIMITER_PER_WINDOW: runtime => runtime.api.rateLimiterPerWindow,
  RATE_LIMITER_ENABLED: runtime => runtime.api.rateLimiterEnabled,
  EXPORT_RATE_LIMITER_ENABLED: runtime => runtime.api.exportRateLimiterEnabled,
  EXPORT_RATE_LIMITER_WINDOW_MS: runtime => runtime.api.exportRateLimiterWindowMs,
  EXPORT_RATE_LIMITER_PER_WINDOW: runtime => runtime.api.exportRateLimiterPerWindow,
  ATTEMPT_LIMITER_ENABLED: runtime => runtime.api.attemptLimiterEnabled,
  NEW_CONDUCTOR_URL: runtime => runtime.api.newConductorUrl,
  REDIRECT_WHITELIST: runtime => runtime.api.redirectWhitelist,
  EMAIL_SERVICE_TYPE: runtime => runtime.api.emailServiceType,
  EMAIL_FROM_ADDRESS: runtime => runtime.api.emailFromAddress,
  EMAIL_FROM_NAME: runtime => runtime.api.emailFromName,
  EMAIL_REPLY_TO: runtime => runtime.api.emailReplyTo,
  SMTP_HOST: runtime => runtime.api.smtpHost,
  SMTP_PORT: runtime => runtime.api.smtpPort,
  SMTP_SECURE: runtime => runtime.api.smtpSecure,
  SMTP_USER: runtime => runtime.api.smtpUser,
  SMTP_PASSWORD: runtime => runtime.api.smtpPassword,
  SMTP_CACHE_EXPIRY_SECONDS: runtime => runtime.api.smtpCacheExpirySeconds,
  TEST_EMAIL_ADDRESS: runtime => runtime.api.testEmailAddress,
  MAXIMUM_LONG_LIVED_DURATION_DAYS: runtime =>
    runtime.api.maximumLongLivedDurationDays,
  BUGSNAG_API_KEY: runtime => runtime.api.bugsnagApiKey ?? '',
  JSON_BODY_LIMIT: runtime => runtime.api.jsonBodyLimit,
  URLENCODED_BODY_LIMIT: runtime => runtime.api.urlencodedBodyLimit,
  RESTORE_UPLOAD_MAX_BYTES: runtime => runtime.api.restoreUploadMaxBytes,
  DOWNLOAD_COOKIE_SAMESITE: runtime => runtime.api.downloadCookieSameSite,
  RECORDS_HYDRATED_PAGE_LIMIT: runtime => runtime.api.recordsHydratedPageLimit,
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

  if (platform !== 'api') {
    applyContract(baseContract, runtime, map);
  }

  if (platform === 'android' || platform === 'all') {
    applyContract(androidContract, runtime, map);
  }

  if (platform === 'ios' || platform === 'all') {
    applyContract(iosContract, runtime, map);
  }

  if (platform === 'api') {
    applyContract(apiContract, runtime, map);
    for (const [key, value] of Object.entries(
      buildAuthProviderEnvMap(runtime.api.authProviders)
    )) {
      map[key] = value;
    }
    for (const [key, value] of Object.entries(runtime.api.extraEnv)) {
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
