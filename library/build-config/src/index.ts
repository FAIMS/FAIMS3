/**
 * Browser-safe entry point for @faims3/build-config.
 *
 * Exposes only the parse/validate side of the config chain (JSON -> typed
 * config, and generated env -> typed config). The generator / CLI side
 * (src/generate-build-config.ts, which imports node:fs / node:child_process)
 * is deliberately NOT re-exported here so it is never pulled into the app or
 * Control Centre browser bundle. Invoke the generator via the package script:
 *   pnpm --filter=@faims3/build-config run generate -- --config … --platform …
 */

export {
  BuildConfigCoreObjectSchema,
  BuildConfigSchema,
  DomainsBuildConfigSchema,
  DomainServiceName,
  RuntimeConfigSchema,
  GeneratedEnvSchema,
  ApiEnvSchema,
  parseBuildConfig,
  toRuntimeConfig,
  parseGeneratedEnv,
  parseApiEnv,
  parseAppsEnv,
  readAuthProviderConfigFromEnv,
  buildAuthProviderEnvMap,
  AuthProviderSchema,
  AuthProviderConfigMapSchema,
} from './build-config.js';
export type {
  SharedBuildConfig,
  RuntimeConfig,
  GeneratedEnv,
  ApiEnv,
  PartialBuildConfig,
} from './build-config.js';
export type {
  AuthProviderConfig,
  AuthProviderConfigMap,
} from './auth-provider-config.js';
