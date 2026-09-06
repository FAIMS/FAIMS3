import {z} from 'zod';

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
  .passthrough();

export const UrlBuildConfigSchema = z.object({
  webUrl: z.string().default('http://localhost:3001').optional(),
  apiUrl: z.string().default('http://localhost:8080').optional(),
  appUrl: z.string().default('http://localhost:3000').optional(),
});

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
  .passthrough();

export const MobileBuildConfigSchema = z
  .object({
    appId: z.string().default('org.fedarch.faims3').optional(),
    android: z
      .object({
        releaseStatus: z.string().default('draft').optional(),
        keystoreFileBase64: z.string().optional(),
        serviceAccountKeyJsonBase64: z.string().optional(),
        keystorePath: z.string().optional(),
        keystorePassword: z.string().optional(),
        keyAlias: z.string().optional(),
        keyPassword: z.string().optional(),
        serviceAccountJsonPath: z.string().optional(),
      })
      .passthrough()
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
      .passthrough()
      .default({}),
  })
  .passthrough();

export const BuildConfigSchema = z
  .object({
    urls: UrlBuildConfigSchema,
    app: AppBuildConfigSchema,
    web: WebBuildConfigSchema,
    mobile: MobileBuildConfigSchema,
    secrets: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export type SharedBuildConfig = z.infer<typeof BuildConfigSchema>;

export function parseBuildConfig(raw: unknown): SharedBuildConfig {
  return BuildConfigSchema.parse(raw);
}
