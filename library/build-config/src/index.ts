// SPDX-License-Identifier: Apache-2.0
/**
 * Browser-safe entry point for @faims3/build-config.
 *
 * Layer 1: JSON → typed deployment config (`parseBuildConfig`).
 * Layer 2: client ENV → typed client runtime config (`parseApiEnv`,
 * `parseAppEnv`, `parseWebEnv`, `parseDesignerEnv`).
 *
 * The generator / CLI side (src/generate-build-config.ts and
 * src/validate-build-config.ts, which import node:fs / node:child_process)
 * is deliberately NOT re-exported here so it is never pulled into the app
 * or Control Centre browser bundle. Invoke those via the package scripts:
 *   pnpm --filter=@faims3/build-config run generate --config … --platform …
 *   pnpm --filter=@faims3/build-config run validate --config-dir …
 */

export {
  BuildConfigCoreObjectSchema,
  BuildConfigSchema,
  DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  SHARED_DEFAULTS,
  DomainsBuildConfigSchema,
  DomainServiceName,
  RuntimeConfigSchema,
  parseBuildConfig,
  toRuntimeConfig,
  readAuthProviderConfigFromEnv,
  buildAuthProviderEnvMap,
  AuthProviderSchema,
  AuthProviderConfigMapSchema,
} from './build-config.js';
export type {
  SharedBuildConfig,
  RuntimeConfig,
  PartialBuildConfig,
} from './build-config.js';
export {ApiEnvSchema, parseApiEnv} from './client-env/api-env.js';
export type {
  ApiEnv,
  ApiRuntimeConfig,
  ParseApiEnvOptions,
  ApiEmailConfig,
  ApiSmtpConfig,
} from './client-env/api-env.js';
export {AppEnvSchema, parseAppEnv} from './client-env/app-env.js';
export type {
  AppEnv,
  AppRuntimeConfig,
  ParseAppEnvOptions,
  AppDirectoryAuth,
} from './client-env/app-env.js';
export {WebEnvSchema, parseWebEnv} from './client-env/web-env.js';
export type {
  WebEnv,
  WebRuntimeConfig,
  ParseWebEnvOptions,
} from './client-env/web-env.js';
export {
  DesignerEnvSchema,
  parseDesignerEnv,
} from './client-env/designer-env.js';
export type {
  DesignerEnv,
  DesignerRuntimeConfig,
} from './client-env/designer-env.js';
export {
  BaseAuthProviderConfigSchema,
  GoogleAuthProviderConfigSchema,
  OIDCAuthProviderConfigSchema,
  SAMLAuthProviderConfigSchema,
  RuntimeAuthProviderSchema,
  RuntimeAuthProviderConfigMapSchema,
  isGoogleProvider,
  isOIDCProvider,
  isSAMLProvider,
  providerIdToEnvProvider,
  authProviderEnvKey,
} from './auth-provider-config.js';
export type {
  BaseAuthProviderConfig,
  GoogleAuthProviderConfig,
  OIDCAuthProviderConfig,
  SAMLAuthProviderConfig,
  AuthProviderConfig,
  AuthProviderConfigInput,
  AuthProviderConfigMap,
  RuntimeAuthProviderConfig,
  RuntimeAuthProviderConfigMap,
} from './auth-provider-config.js';
export {
  buildEnvMapFromRuntime,
  buildStringEnvMapFromRuntime,
  envValueToString,
} from './env-contract.js';
export type {SupportedPlatform, EnvValue} from './env-contract.js';
export {escapeEnvNewlines} from './env-value.js';
export {resolveInjectedAppVersion, OptionalCsvSchema} from './env-coercion.js';
export {
  ThemeSchema,
  NotebookListTypeSchema,
  NavigationStyleSchema,
  MapSourceSchema,
  MapStyleSchema,
  SatelliteSourceSchema,
  AutosuggestSourceSchema,
  ForceRemoteDeletionSchema,
  KeySourceSchema,
  ProvisionSsoUsersPolicySchema,
  EmailServiceTypeSchema,
  DownloadCookieSameSiteSchema,
  deriveNotebookNames,
  buildMapConfig,
} from './shared-schemas.js';
export type {
  Theme,
  NotebookListType,
  NavigationStyle,
  MapSource,
  MapStyle,
  SatelliteSource,
  AutosuggestSource,
  ForceRemoteDeletion,
  KeySource,
  ProvisionSsoUsersPolicy,
  EmailServiceType,
  DownloadCookieSameSite,
} from './shared-schemas.js';
