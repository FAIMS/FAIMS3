// SPDX-License-Identifier: Apache-2.0
/**
 * Layer 1 — unified `core.json` schema.
 *
 * `parseBuildConfig` validates deployment JSON (plus merged secrets) into a
 * typed `RuntimeConfig`. Env generation (`buildEnvMapFromRuntime`) is the
 * transport out of this layer. Client ENV parsing lives in `src/client-env/`.
 */
import {z} from 'zod';
import {AuthProviderConfigMapSchema} from './auth-provider-config.js';
export {
  AuthProviderSchema,
  AuthProviderConfigMapSchema,
  readAuthProviderConfigFromEnv,
  buildAuthProviderEnvMap,
} from './auth-provider-config.js';
export {
  BoolEnvSchema,
  PositiveIntStringSchema,
  OptionalCsvSchema,
  UpperCsvSchema,
  parseMaxLongLivedDays,
  sanitizeCommitVersion,
  parseBugsnagKey,
  resolveInjectedAppVersion,
  NO_MAXIMUM_WORDS,
} from './env-coercion.js';
export {
  DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  SHARED_DEFAULTS,
} from './shared-schemas.js';
import {
  AttachmentStorageTypeSchema,
  AutosuggestSourceSchema,
  CapacityProviderTypeSchema,
  CapacityScaleThresholdsArraySchema,
  DownloadCookieSameSiteSchema,
  EmailServiceTypeSchema,
  ForceRemoteDeletionSchema,
  GdalNumThreadsJsonSchema,
  KeySourceSchema,
  MapSourceSchema,
  MapStyleSchema,
  NavigationStyleSchema,
  NotebookListTypeSchema,
  ProvisionSsoUsersPolicySchema,
  SHARED_DEFAULTS,
  SatelliteSourceSchema,
  ThemeSchema,
  clampOfflineMaps,
  resolveLongLivedDurationHints,
  resolveStartupMigrationLockEnabled,
  validateMapAndAutosuggestKeys,
  validateMigrationLock,
} from './shared-schemas.js';

const EndpointsBuildConfigSchema = z
  .object({
    /** Control Centre base URL. Overridden when `domains` is set. */
    webUrl: z.string().default('http://localhost:3001'),
    /** Conductor API base URL. Overridden when `domains` is set. */
    apiUrl: z.string().default('http://localhost:8080'),
    /** Mobile app / PWA base URL. Overridden when `domains` is set. */
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
    /** Allowed OAuth/local-login redirect origins. Derived from public URLs if omitted. */
    redirectWhitelist: z.array(z.string()).optional(),
  })
  .strict();

/** Allowed service names in `core.domains.services` / `localOverride`. */
export const DomainServiceName = z.enum([
  'conductor',
  'couch',
  'web',
  'app',
  'docs',
]);

const DomainHostMap = z
  .object({
    conductor: z.string().min(1).optional(),
    couch: z.string().min(1).optional(),
    web: z.string().min(1).optional(),
    app: z.string().min(1).optional(),
    docs: z.string().min(1).optional(),
  })
  .strict();

/**
 * The deployment's domain structure. Instead of storing concrete
 * endpoint URLs, the core names a base domain + per-service subdomains, and the
 * concrete `endpoints` are DERIVED from it (in the shared invariants transform).
 * A `localOverride` (optional) sets literal `host:port` hosts for one or more
 * services - its presence is the "local/dev" switch (protocol defaults to
 * http), so a production env omits it and a local/dev env sets it.
 *
 * This is optional so existing configs that still store concrete `endpoints`
 * keep working; when present it overrides the derived endpoints, and the app
 * build, web build and CDK all derive the same URLs from it (so they cannot
 * drift). The service-name set (conductor/couch/web/app/docs) is confirmed
 * against real deployments before the model is frozen.
 */
export const DomainsBuildConfigSchema = z
  .object({
    /** The base domain, e.g. `faims.example.com` (no protocol, no host:port). */
    base: z.string().min(1),
    protocol: z.enum(['http', 'https']).default('https'),
    /** Subdomain per service (e.g. conductor = `api` -> `api.faims.example.com`). */
    services: DomainHostMap.default({}),
    /** Optional literal `host:port` overrides for local/dev (protocol -> http). */
    localOverride: DomainHostMap.optional(),
  })
  .strict()
  .optional();

const BrandingBuildConfigSchema = z
  .object({
    appName: z.string().default('FAIMS'),
    /** Falls back to `appName`. */
    appShortName: z.string().optional(),
    /** Banner heading; falls back to `appName`. */
    headingAppName: z.string().optional(),
    theme: ThemeSchema.default('default'),
    websiteTitle: z.string().default('Control Centre'),
    /** Couch/directory cluster-admin group name baked into the app build. */
    clusterAdminGroupName: z.string().default('cluster-admin'),
    conductorInstanceName: z.string().default('Development FAIMS Server'),
    conductorDescription: z.string().default('FAIMS Conductor Server'),
    /** Invite-code prefix `{prefix}-{code}`. */
    conductorShortCodePrefix: z.string().default('FAIMS'),
  })
  .strict();

const SupportBuildConfigSchema = z
  .object({
    supportEmail: z.string().default('support@fieldmark.au'),
    privacyPolicyUrl: z.string().default('https://fieldnote.au/privacy'),
    /** Empty hides the contact link. */
    appContactUrl: z.string().default(''),
    docsUrl: z.string().default(''),
  })
  .strict();

const NotebookAndRecordUxBuildConfigSchema = z
  .object({
    /** Lowercase singular notebook noun (`project`, `survey`, …). */
    notebookName: z.string().default('project'),
    notebookListType: NotebookListTypeSchema.default('tabs'),
    navigation: NavigationStyleSchema.default('none'),
    showStatusTab: z.boolean().default(true),
    showNewNotebook: z.boolean().default(true),
    showRecordSummaryCounts: z.boolean().default(true),
  })
  .strict();

const MapsBuildConfigSchema = z
  .object({
    mapSource: MapSourceSchema.default('osm'),
    /** Public/client tile key. */
    mapSourceKey: z.string().default(''),
    satelliteSource: SatelliteSourceSchema.optional(),
    mapStyle: MapStyleSchema.default('basic'),
    /** Clamped off when `mapSource` is `osm`. */
    offlineMaps: z.boolean().default(true),
    autosuggestSource: AutosuggestSourceSchema.default('none'),
    /** Required when `autosuggestSource` is `mapbox`. */
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
    syncPushOnlyRecordThreshold: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.syncPushOnlyRecordThreshold),
    forceRemoteDeletion: ForceRemoteDeletionSchema.default('never'),
    /** Wipe local Pouch data on manual deactivate. */
    deleteOnDeactivation: z.boolean().default(false),
  })
  .strict();

const AttachmentsBuildConfigSchema = z
  .object({
    attachmentServiceType: z.string().default('COUCH'),
    attachmentDocumentIdPrefix: z.string().optional(),
  })
  .strict();

/**
 * Map-layer object storage (`ATTACHMENT_STORAGE_TYPE`, `ATTACHMENT_S3_*`).
 * On AWS ECS, the CDK creates the private S3 bucket and grants the task role,
 * overriding `bucket` and `region` and omitting `endpoint`/static credentials.
 */
export const AttachmentStorageBuildConfigSchema = z
  .object({
    /** Object-store backend for map-layer files (`S3` or `MOCK`). */
    serviceType: AttachmentStorageTypeSchema.default('S3'),
    /** Bucket that holds map-layer objects. */
    bucket: z.string().min(1).default(SHARED_DEFAULTS.attachmentS3Bucket),
    /** Key prefix inside the bucket (no leading/trailing slash), e.g. `map-assets`. */
    prefix: z.string().min(1).default(SHARED_DEFAULTS.attachmentS3Prefix),
    /** AWS region, or a dummy region for RustFS (`us-east-1`). */
    region: z.string().min(1).default(SHARED_DEFAULTS.attachmentS3Region),
    /** Custom S3 endpoint for RustFS / MinIO / Spaces. Omit for AWS S3. */
    endpoint: z.string().optional(),
    /** Host-visible S3 endpoint used when signing download URLs. */
    publicEndpoint: z.string().optional(),
    /** Path-style S3 URLs. Defaults to true when `endpoint` is set. */
    forcePathStyle: z.boolean().optional(),
    /** Secret slot: static access key (local RustFS / non-AWS S3). Omit on ECS. */
    accessKeyId: z.string().optional(),
    /** Secret slot: static secret key (local RustFS / non-AWS S3). Omit on ECS. */
    secretAccessKey: z.string().optional(),
  })
  .strict();

/**
 * Spatial worker pool & GDAL/tippecanoe runtime tuning.
 * On AWS ECS, Fargate sizing and worker/manager overrides live in `aws.spatialCapacity`.
 */
export const SpatialCapacityBuildConfigSchema = z
  .object({
    /** Capacity provider (`FIXED`, `ECS`, or `MOCK`). */
    provider: CapacityProviderTypeSchema.default('FIXED'),
    /** Max drain workers the capacity manager may ask for at once. */
    maxCapacity: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.capacityMax),
    /**
     * Queue depths at which worker count increases from 1.
     * `[3, 8, 16, 32]` means 1→2 at 3 jobs, 2→3 at 8, 3→4 at 16, 4→5 at 32.
     */
    scaleThresholds: CapacityScaleThresholdsArraySchema.default([
      ...SHARED_DEFAULTS.capacityScaleThresholds,
    ]),
    /** How often the capacity manager reads the Couch queue (ms). */
    reconcileMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.capacityReconcileMs),
    /**
     * How long the oldest unclaimed job may wait before the manager asks for
     * the first extra worker. `0` disables. Default 5 minutes.
     */
    starvationMs: z
      .number()
      .int()
      .nonnegative()
      .default(SHARED_DEFAULTS.capacityStarvationMs),
    /**
     * Cooldown before another extra worker from the same stale job (ms).
     * Omit to use `2 * starvationMs`. `0` keeps only the first extra.
     */
    scaleInCooldownMs: z.number().int().nonnegative().optional(),
    /** Replica count reported by the FIXED provider. */
    fixedReplicas: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.capacityFixedReplicas),
    /** Worker exits after this many ms with no job (`0` never exits). */
    idleExitMs: z
      .number()
      .int()
      .nonnegative()
      .default(SHARED_DEFAULTS.spatialWorkerIdleExitMs),
    /** Delay between empty spatial-worker polls (ms). */
    pollMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.spatialWorkerPollMs),
    /** GDAL worker threads (`ALL_CPUS` or a positive integer cap). */
    gdalNumThreads: GdalNumThreadsJsonSchema.default(
      SHARED_DEFAULTS.gdalNumThreads
    ),
    /** Raster block cache in megabytes (`GDAL_CACHEMAX`). */
    gdalCacheMaxMb: z
      .number()
      .int()
      .positive()
      .max(65536)
      .default(SHARED_DEFAULTS.gdalCacheMaxMb),
    /** `gdalwarp -wm` working buffer in megabytes. */
    gdalWarpMemoryMb: z
      .number()
      .int()
      .positive()
      .max(65536)
      .default(SHARED_DEFAULTS.gdalWarpMemoryMb),
    /** `gdalwarp -multi`: overlap I/O with compute. */
    gdalWarpMulti: z.boolean().default(SHARED_DEFAULTS.gdalWarpMulti),
    /** Cap tippecanoe threads (`TIPPECANOE_MAX_THREADS`). Omit for all CPUs. */
    tippecanoeMaxThreads: z.number().int().positive().max(256).optional(),
  })
  .strict();

const MigrationBuildConfigSchema = z
  .object({
    /** App-side migrate of legacy v1 Pouch databases. */
    migrateOldDatabases: z.boolean().default(false),
    /** Skip API-boot Couch migrate. */
    disableMigrateOnStartup: z.boolean().default(false),
    /**
     * Optional so omit vs explicit false stay distinct: local API treats
     * omit as off, AWS CDK treats omit as on (clustered default) and
     * honours an explicit false (single-task / debug).
     */
    startupMigrationLockEnabled: z.boolean().optional(),
    startupMigrationLockTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.startupMigrationLockTimeoutMs),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateMigrationLock(data, ctx);
  })
  .transform(data => ({
    ...data,
    // Skip-migrate makes the lock unused. Otherwise keep omit as
    // undefined so AWS can default-on while still honouring false.
    startupMigrationLockEnabled: resolveStartupMigrationLockEnabled(
      data.disableMigrateOnStartup,
      data.startupMigrationLockEnabled
    ),
  }));

const AuthBuildConfigSchema = z
  .object({
    /** Auth profile / JWT key id. */
    profileName: z.string().default('local-dev'),
    keyFilePath: z.string().default('.'),
    keySource: KeySourceSchema.default('FILE'),
    /** Required when `keySource` is `AWS_SM`. */
    awsSecretKeyArn: z.string().optional(),
    /** Secret slot; empty in committed core. */
    cookieSecret: z.string().default(''),
    disableLocalLogin: z.boolean().default(false),
    provisionSsoUsersPolicy: ProvisionSsoUsersPolicySchema.default('reject'),
  })
  .strict();

const AuthTokensBuildConfigSchema = z
  .object({
    tokenRefreshIntervalMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.tokenRefreshIntervalMs),
    tokenRefreshWindowMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.tokenRefreshWindowMs),
    loginBannerGraceMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.loginBannerGraceMs),
    ignoreTokenExp: z.boolean().default(false),
    /** Duration chips (days); clamped to `maximumLongLivedDurationDays`. */
    longLivedTokenDurationHints: z
      .array(z.number().int().positive())
      .optional(),
    refreshTokenExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.refreshTokenExpiryMinutes),
    accessTokenExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.accessTokenExpiryMinutes),
    impersonationSessionExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.impersonationSessionExpiryMinutes),
    emailCodeExpiryMinutes: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.emailCodeExpiryMinutes),
    /** Cap on long-lived tokens; `'unlimited'` disables the cap. */
    maximumLongLivedDurationDays: z
      .union([z.number().int().positive(), z.literal('unlimited')])
      .default(SHARED_DEFAULTS.maximumLongLivedDurationDays),
  })
  .strict();

const LimitsBuildConfigSchema = z
  .object({
    rateLimiterEnabled: z.boolean().default(true),
    rateLimiterWindowMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.rateLimiterWindowMs),
    rateLimiterPerWindow: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.rateLimiterPerWindow),
    exportRateLimiterEnabled: z.boolean().default(true),
    exportRateLimiterWindowMs: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.exportRateLimiterWindowMs),
    exportRateLimiterPerWindow: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.exportRateLimiterPerWindow),
    /** Email-code / verification attempt limiter. */
    attemptLimiterEnabled: z.boolean().default(true),
    jsonBodyLimit: z.string().default(SHARED_DEFAULTS.jsonBodyLimit),
    urlencodedBodyLimit: z
      .string()
      .default(SHARED_DEFAULTS.urlencodedBodyLimit),
    restoreUploadMaxBytes: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.restoreUploadMaxBytes),
    downloadCookieSameSite: DownloadCookieSameSiteSchema.default('lax'),
    recordsHydratedPageLimit: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.recordsHydratedPageLimit),
  })
  .strict();

const EmailBuildConfigSchema = z
  .object({
    emailServiceType: EmailServiceTypeSchema.default('MOCK'),
    emailFromAddress: z.string().default('notifications@example.com'),
    emailFromName: z.string().default('FAIMS Notification'),
    emailReplyTo: z.string().default('support@example.com'),
    /** Required in API ENV when `emailServiceType` is SMTP (not under test). */
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().positive().default(SHARED_DEFAULTS.smtpPort),
    smtpSecure: z.boolean().default(false),
    /** Secret slot. */
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    smtpCacheExpirySeconds: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.smtpCacheExpirySeconds),
    testEmailAddress: z.string().optional(),
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
    /** Public/client Bugsnag key; blank or `false` disables reporting. */
    bugsnagApiKey: z.string().optional(),
    /** Start the 1 Hz API stdout memory sampler for leak hunts. */
    memoryMonitorEnabled: z.boolean().default(false),
    /** Write Morgan combined-format HTTP access lines on the API server. */
    requestLoggingEnabled: z.boolean().default(true),
  })
  .strict();

const TeamAndRolePolicyBuildConfigSchema = z
  .object({
    /** TEAM role ids hidden from Control Centre dropdowns. */
    excludedTeamRoles: z.array(z.string()).default([]),
  })
  .strict();

const WebDesignerLimitsBuildConfigSchema = z
  .object({
    maxDesignFileSizeMb: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.maxDesignFileSizeMb),
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
    /** Package id / Play Store application id. */
    appId: z.string().default('org.fedarch.faims3'),
    /** Fastlane track: `draft` or `production`. */
    releaseStatus: z.string().default('draft'),
    /** Secret slot — keystore, base64. */
    keystoreFileBase64: z.string().optional(),
    /** Secret slot — Play service-account JSON, base64. */
    serviceAccountKeyJsonBase64: z.string().optional(),
    keystorePassword: z.string().optional(),
    keyAlias: z.string().optional(),
    keyPassword: z.string().optional(),
  })
  .strict();

const IosBuildConfigSchema = z
  .object({
    /** Falls back to `android.appId` when omitted. */
    bundleIdentifier: z.string().optional(),
    developerPortalTeamId: z.string().optional(),
    appStoreConnectTeamId: z.string().optional(),
    appleId: z.string().optional(),
    appleApplicationSpecificPassword: z.string().optional(),
    matchPassword: z.string().optional(),
    matchGitUrl: z.string().optional(),
    gitAuthorization: z.string().optional(),
    provisioningProfileSpecifier: z.string().optional(),
    /** Team-key id; individual-key flows use this or `appleIndividualKeyId`. */
    appleKeyId: z.string().optional(),
    /** Team-key issuer; omit for individual-key flows. */
    appleIssuerId: z.string().optional(),
    appleKeyContent: z.string().optional(),
    appleIndividualKeyId: z.string().optional(),
    appleIndividualKeyContent: z.string().optional(),
  })
  .strict();

const CouchdbBuildConfigSchema = z
  .object({
    user: z.string().default('admin'),
    /** Secret slot; required in API ENV. */
    password: z.string().optional(),
    externalPort: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.couchdbExternalPort),
  })
  .strict();

/** Conductor (API server) port topology: the published/external surface
 * port and the port the process binds. On AWS the CDK pins both to the
 * deployed values (ALB 443 / container 8000) regardless of core. */
const ConductorBuildConfigSchema = z
  .object({
    externalPort: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.conductorExternalPort),
    internalPort: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.conductorInternalPort),
  })
  .strict();

const DevBuildConfigSchema = z
  .object({
    developerMode: z.boolean().default(false),
    debugApp: z.boolean().default(false),
    debugPouchDb: z.boolean().default(false),
    /** Show the "wipe data" developer action. */
    showWipe: z.boolean().default(true),
    showPouchDbBrowser: z.boolean().default(true),
  })
  .strict();

const PouchdbBuildConfigSchema = z
  .object({
    pouchBatchSize: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.pouchBatchSize),
    pouchBatchesLimit: z
      .number()
      .int()
      .positive()
      .default(SHARED_DEFAULTS.pouchBatchesLimit),
  })
  .strict();

/**
 * Optional `secrets` section retained for structural compatibility.
 *
 * In the canonical overlay flow, `secrets.json` / `secrets.enc.json` is a
 * partial `core.json` (see `config/secrets.sample.json`) that deep-merges
 * directly into the top-level groups (`auth`, `authProviders`, `email`,
 * `couchdb`, `maps`, `observability`, `android`, `ios`). On AWS, secret values
 * are injected from Secrets Manager via the ARNs in `aws.json`.
 *
 * All slots here are optional/empty so configs that include or omit `secrets`
 * remain valid.
 */
const SecretsBuildConfigSchema = z
  .object({
    /** Server-side auth secrets. */
    auth: z
      .object({
        cookieSecret: z.string().optional(),
        /**
         * Per-provider secrets, keyed by provider id (google, someOidc, …).
         * The fields match the optional secret fields on the provider config
         * (clientID/clientSecret for google+oidc; privateKey/publicKey/idpPublicKey
         * for saml). Empty in the committed core; filled per platform (SOPS for
         * mobile/local, AWS Secrets Manager for the CDK).
         */
        authProviders: z
          .record(
            z.string(),
            z
              .object({
                clientID: z.string().optional(),
                clientSecret: z.string().optional(),
                privateKey: z.string().optional(),
                publicKey: z.string().optional(),
                idpPublicKey: z.string().optional(),
              })
              .strict()
          )
          .optional(),
      })
      .strict()
      .optional(),
    /** SMTP credentials. */
    email: z
      .object({
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Bugsnag API key (mobile builds). */
    observability: z
      .object({
        bugsnagApiKey: z.string().optional(),
      })
      .strict()
      .optional(),
    /** CouchDB admin password. */
    couchdb: z
      .object({
        password: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Map-layer object-store static credentials (local RustFS / non-AWS S3). */
    attachmentStorage: z
      .object({
        accessKeyId: z.string().optional(),
        secretAccessKey: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Map / address-autosuggest provider keys (mobile builds). */
    maps: z
      .object({
        mapSourceKey: z.string().optional(),
        autosuggestMapboxKey: z.string().optional(),
        autosuggestMapTilerKey: z.string().optional(),
      })
      .strict()
      .optional(),
    /** Mobile platform secrets (keystore / match / Apple keys). */
    mobile: z
      .object({
        android: z
          .object({
            keystoreFileBase64: z.string().optional(),
            serviceAccountKeyJsonBase64: z.string().optional(),
            keystorePassword: z.string().optional(),
            keyAlias: z.string().optional(),
            keyPassword: z.string().optional(),
          })
          .strict()
          .optional(),
        ios: z
          .object({
            appleApplicationSpecificPassword: z.string().optional(),
            matchPassword: z.string().optional(),
            matchGitUrl: z.string().optional(),
            gitAuthorization: z.string().optional(),
            appleKeyId: z.string().optional(),
            appleIssuerId: z.string().optional(),
            appleKeyContent: z.string().optional(),
            appleIndividualKeyId: z.string().optional(),
            appleIndividualKeyContent: z.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .default({});

/**
 * The canonical config as produced by the schema (after defaults + invariants
 * are applied). Defined independently of the schema so that the top-level
 * `.transform()` does not create a circular type (zod 4 + tsc).
 */
export type SharedBuildConfig = {
  endpoints: z.infer<typeof EndpointsBuildConfigSchema>;
  /** Optional domain structure; when set, `endpoints` are derived from it. */
  domains?: z.infer<typeof DomainsBuildConfigSchema>;
  branding: z.infer<typeof BrandingBuildConfigSchema>;
  support: z.infer<typeof SupportBuildConfigSchema>;
  notebookAndRecordUX: z.infer<typeof NotebookAndRecordUxBuildConfigSchema>;
  maps: z.infer<typeof MapsBuildConfigSchema>;
  sync: z.infer<typeof SyncBuildConfigSchema>;
  attachments: z.infer<typeof AttachmentsBuildConfigSchema>;
  attachmentStorage: z.infer<typeof AttachmentStorageBuildConfigSchema>;
  spatialCapacity: z.infer<typeof SpatialCapacityBuildConfigSchema>;
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
  conductor: z.infer<typeof ConductorBuildConfigSchema>;
  dev: z.infer<typeof DevBuildConfigSchema>;
  pouchdb: z.infer<typeof PouchdbBuildConfigSchema>;
  /** Dedicated, optional secret slots; empty in committed core. */
  secrets: z.infer<typeof SecretsBuildConfigSchema>;
};

/**
 * Derive the concrete endpoint URLs from the domain structure.
 * A `localOverride` host is used verbatim with http; otherwise each service is
 * `${protocol}://${services[service]}.${base}`. Only the fields the model names
 * are set; the rest of `endpoints` (couchdbInternalUrl, the app public URLs,
 * redirectWhitelist) keep their own defaults / input.
 */
function deriveEndpointsFromDomains(
  domains: NonNullable<z.infer<typeof DomainsBuildConfigSchema>>
): Partial<z.infer<typeof EndpointsBuildConfigSchema>> {
  const {base, protocol, services, localOverride} = domains;
  const resolve = (service: z.infer<typeof DomainServiceName>): string => {
    const override = localOverride?.[service];
    if (override) return `http://${override}`;
    const subdomain = services[service];
    if (!subdomain) return '';
    return `${protocol}://${subdomain}.${base}`;
  };
  const conductorUrl = resolve('conductor');
  const webUrl = resolve('web');
  const appUrl = resolve('app');
  const couchUrl = resolve('couch');
  const derived: Partial<z.infer<typeof EndpointsBuildConfigSchema>> = {};
  if (conductorUrl) {
    derived.apiUrl = conductorUrl;
    derived.conductorUrls = [conductorUrl];
  }
  if (webUrl) derived.webUrl = webUrl;
  if (appUrl) derived.appUrl = appUrl;
  if (couchUrl) derived.couchdbPublicUrl = couchUrl;
  return derived;
}

/**
 * Overlay non-empty values from `c.secrets` into their corresponding top-level
 * config groups so configs that populate `core.secrets.*` (instead of or in
 * addition to top-level group fields) flow into the runtime config and env contract.
 */
function applySecretsOverlay(c: SharedBuildConfig): void {
  const s = c.secrets;
  if (!s) return;

  if (s.auth) {
    if (s.auth.cookieSecret) c.auth.cookieSecret = s.auth.cookieSecret;
    if (s.auth.authProviders) {
      for (const [providerId, sec] of Object.entries(s.auth.authProviders)) {
        const target = c.authProviders[providerId] as
          | Record<string, unknown>
          | undefined;
        if (!target) continue;
        for (const [key, val] of Object.entries(sec)) {
          if (val !== undefined && val !== '') {
            target[key] = val;
          }
        }
      }
    }
  }
  if (s.email) {
    if (s.email.smtpUser) c.email.smtpUser = s.email.smtpUser;
    if (s.email.smtpPassword) c.email.smtpPassword = s.email.smtpPassword;
  }
  if (s.observability?.bugsnagApiKey) {
    c.observability.bugsnagApiKey = s.observability.bugsnagApiKey;
  }
  if (s.couchdb?.password) {
    c.couchdb.password = s.couchdb.password;
  }
  if (s.attachmentStorage) {
    if (s.attachmentStorage.accessKeyId) {
      c.attachmentStorage.accessKeyId = s.attachmentStorage.accessKeyId;
    }
    if (s.attachmentStorage.secretAccessKey) {
      c.attachmentStorage.secretAccessKey = s.attachmentStorage.secretAccessKey;
    }
  }
  if (s.maps) {
    if (s.maps.mapSourceKey) c.maps.mapSourceKey = s.maps.mapSourceKey;
    if (s.maps.autosuggestMapboxKey) {
      c.maps.autosuggestMapboxKey = s.maps.autosuggestMapboxKey;
    }
    if (s.maps.autosuggestMapTilerKey) {
      c.maps.autosuggestMapTilerKey = s.maps.autosuggestMapTilerKey;
    }
  }
  if (s.mobile?.android) {
    const target = c.android as Record<string, unknown>;
    for (const [key, val] of Object.entries(s.mobile.android)) {
      if (val !== undefined && val !== '') {
        target[key] = val;
      }
    }
  }
  if (s.mobile?.ios) {
    const target = c.ios as Record<string, unknown>;
    for (const [key, val] of Object.entries(s.mobile.ios)) {
      if (val !== undefined && val !== '') {
        target[key] = val;
      }
    }
  }
}

/**
 * Applies the shared cross-field invariants so that every
 * JSON entry point yields the same canonical semantics:
 *  - non-empty `secrets.*` slots overlay onto their target groups
 *  - endpoints are derived from the domain structure when `domains` is set
 *  - conductorUrls falls back to apiUrl when empty (login needs at least one)
 *  - short / heading names fall back to the app name
 *  - ios.bundleIdentifier falls back to android.appId
 *  - offline maps are forced off for OSM (no bulk download)
 *  - long-lived token hints default to the shared chip list, then are clamped
 *    to the max duration, deduped, sorted
 *  - redirectWhitelist falls back to the derived public endpoints
 */
function applySharedInvariants(c: SharedBuildConfig): SharedBuildConfig {
  applySecretsOverlay(c);
  // Derive the concrete endpoints from the domain structure (when present),
  // overriding the endpoint defaults. Shared by the app build, web build and
  // the CDK so the same core.domains cannot yield drifting URLs.
  if (c.domains) {
    const derived = deriveEndpointsFromDomains(c.domains);
    const ep = c.endpoints as Record<string, unknown>;
    for (const [key, value] of Object.entries(derived)) {
      if (value !== undefined) ep[key] = value;
    }
  }
  // The app authenticates against conductorUrls. An omitted / empty list
  // (a core that only set apiUrl) must still yield a server — fall back
  // to the Conductor / API URL.
  if (!c.endpoints.conductorUrls.length && c.endpoints.apiUrl) {
    c.endpoints.conductorUrls = [c.endpoints.apiUrl];
  }
  if (!c.branding.appShortName) c.branding.appShortName = c.branding.appName;
  if (!c.branding.headingAppName)
    c.branding.headingAppName = c.branding.appName;
  if (!c.ios.bundleIdentifier) c.ios.bundleIdentifier = c.android.appId;
  c.maps.offlineMaps = clampOfflineMaps(c.maps.mapSource, c.maps.offlineMaps);
  c.authTokens.longLivedTokenDurationHints = resolveLongLivedDurationHints(
    c.authTokens.longLivedTokenDurationHints,
    c.authTokens.maximumLongLivedDurationDays
  );
  if (!c.endpoints.redirectWhitelist?.length) {
    const derived = [
      c.endpoints.apiUrl,
      c.endpoints.appUrl,
      c.endpoints.webUrl,
    ].filter((url): url is string => !!url);
    if (derived.length > 0) {
      c.endpoints.redirectWhitelist = [...new Set(derived)];
    }
  }
  return c;
}

/**
 * The core shared config object: every top-level group, each defaulted and
 * `.strict()`, but WITHOUT the shared invariants transform. Exported so
 * deployment tooling (e.g. the aws-cdk `config.core` slot) can
 * compose it into a nested schema without re-declaring the groups.
 */
export const BuildConfigCoreObjectSchema = z
  .object({
    endpoints: EndpointsBuildConfigSchema.default(() =>
      EndpointsBuildConfigSchema.parse({})
    ),
    domains: DomainsBuildConfigSchema,
    branding: BrandingBuildConfigSchema.default(() =>
      BrandingBuildConfigSchema.parse({})
    ),
    support: SupportBuildConfigSchema.default(() =>
      SupportBuildConfigSchema.parse({})
    ),
    notebookAndRecordUX: NotebookAndRecordUxBuildConfigSchema.default(() =>
      NotebookAndRecordUxBuildConfigSchema.parse({})
    ),
    maps: MapsBuildConfigSchema.default(() => MapsBuildConfigSchema.parse({})),
    sync: SyncBuildConfigSchema.default(() => SyncBuildConfigSchema.parse({})),
    attachments: AttachmentsBuildConfigSchema.default(() =>
      AttachmentsBuildConfigSchema.parse({})
    ),
    attachmentStorage: AttachmentStorageBuildConfigSchema.default(() =>
      AttachmentStorageBuildConfigSchema.parse({})
    ),
    spatialCapacity: SpatialCapacityBuildConfigSchema.default(() =>
      SpatialCapacityBuildConfigSchema.parse({})
    ),
    migration: MigrationBuildConfigSchema.default(() =>
      MigrationBuildConfigSchema.parse({})
    ),
    auth: AuthBuildConfigSchema.default(() => AuthBuildConfigSchema.parse({})),
    authProviders: AuthProviderConfigMapSchema.default(() =>
      AuthProviderConfigMapSchema.parse({})
    ),
    authTokens: AuthTokensBuildConfigSchema.default(() =>
      AuthTokensBuildConfigSchema.parse({})
    ),
    limits: LimitsBuildConfigSchema.default(() =>
      LimitsBuildConfigSchema.parse({})
    ),
    email: EmailBuildConfigSchema.default(() =>
      EmailBuildConfigSchema.parse({})
    ),
    observability: ObservabilityBuildConfigSchema.default(() =>
      ObservabilityBuildConfigSchema.parse({})
    ),
    teamAndRolePolicy: TeamAndRolePolicyBuildConfigSchema.default(() =>
      TeamAndRolePolicyBuildConfigSchema.parse({})
    ),
    webDesignerLimits: WebDesignerLimitsBuildConfigSchema.default(() =>
      WebDesignerLimitsBuildConfigSchema.parse({})
    ),
    android: AndroidBuildConfigSchema.default(() =>
      AndroidBuildConfigSchema.parse({})
    ),
    ios: IosBuildConfigSchema.default(() => IosBuildConfigSchema.parse({})),
    couchdb: CouchdbBuildConfigSchema.default(() =>
      CouchdbBuildConfigSchema.parse({})
    ),
    conductor: ConductorBuildConfigSchema.default(() =>
      ConductorBuildConfigSchema.parse({})
    ),
    dev: DevBuildConfigSchema.default(() => DevBuildConfigSchema.parse({})),
    pouchdb: PouchdbBuildConfigSchema.default(() =>
      PouchdbBuildConfigSchema.parse({})
    ),
    secrets: SecretsBuildConfigSchema,
  })
  .strict();

/**
 * The full shared config: the core object + the shared invariants transform.
 * This is what `core.json` (and the merged secrets overlay) is validated
 * against before env generation.
 */
export const BuildConfigSchema = BuildConfigCoreObjectSchema.transform(
  applySharedInvariants
).superRefine((c, ctx) => {
  validateMapAndAutosuggestKeys(c.maps, ctx, {
    mapbox: ['maps', 'autosuggestMapboxKey'],
    tiler: ['maps', 'autosuggestMapTilerKey'],
  });
});

/**
 * Same shape as SharedBuildConfig. Kept as an alias so generator, contract
 * and parser share one canonical type name going forward.
 */
export const RuntimeConfigSchema = BuildConfigSchema;

/** Alias for {@link SharedBuildConfig} after defaults and shared invariants are applied. */
export type RuntimeConfig = SharedBuildConfig;

/**
 * A config where each top-level group and its scalar fields may be absent.
 * Consumed by toRuntimeConfig (whose schema fills the remaining defaults)
 * when generating env from a partial JSON object.
 */
export type PartialBuildConfig = {
  [K in keyof SharedBuildConfig]?: Partial<SharedBuildConfig[K]>;
};

/** Parse and validate source JSON config into the canonical config. */
export function parseBuildConfig(raw: unknown): SharedBuildConfig {
  return BuildConfigSchema.parse(raw);
}

/** Fill defaults/invariants in a partial config to produce the runtime config. */
export function toRuntimeConfig(parsed: PartialBuildConfig): RuntimeConfig {
  return RuntimeConfigSchema.parse(parsed);
}
