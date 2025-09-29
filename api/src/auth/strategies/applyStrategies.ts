import passport from 'passport';
import {oidcStrategyGenerator} from './oidcStrategy';
import {googleStrategyGenerator} from './googleStrategy';
import {existsSync, readFileSync} from 'fs';
import {getLocalAuthStrategy} from './localStrategy';
import {
  AuthProviderConfigMap,
  AuthProviderConfigMapSchema,
  BaseAuthProviderConfig,
  GoogleAuthProviderConfig,
  OIDCAuthProviderConfig,
} from './strategyTypes';

// Read the configuration file if present and parse
// return null if not found (no configured providers)
export const readAuthProviderConfig = (): AuthProviderConfigMap | null => {
  const configFile = './authConfig.json';
  if (!existsSync(configFile)) {
    console.log(
      'No oidc.json file found, no OIDC providers will be configured.'
    );
    return null;
  }
  const rawData = JSON.parse(readFileSync(configFile, 'utf-8'));
  // Before we validate this, add keys lowercased as id to each entry
  for (const key in rawData) {
    rawData[key].id = key.toLowerCase();
  }
  const parsed = AuthProviderConfigMapSchema.safeParse(rawData);
  if (!parsed.success) {
    console.error(
      'Error parsing auth provider config: ',
      JSON.stringify(parsed.error.format(), null, 2)
    );
    return null;
  }

  return parsed.success ? parsed.data : null;
};
// read once and store the result
const AUTH_PROVIDER_CONFIG = readAuthProviderConfig();

// provide an accessor function
export const getAuthProviderConfig = (): AuthProviderConfigMap | null => {
  return AUTH_PROVIDER_CONFIG;
};

// This function takes the callback URL and generates the passport strategy
export type StrategyGeneratorFunction = (
  params: BaseAuthProviderConfig
) => passport.Strategy;

// This maps the provider name/enum -> stragety generator function
const AUTH_STRATEGIES: Record<string, StrategyGeneratorFunction> = {} as Record<
  string,
  StrategyGeneratorFunction
>;

export const registerAuthProvider = (
  provider: string,
  generator: StrategyGeneratorFunction
) => {
  AUTH_STRATEGIES[provider] = generator;
};

export const getStrategyGenerator = (
  provider: string
): StrategyGeneratorFunction => {
  return AUTH_STRATEGIES[provider];
};

export const registerAuthProviders = () => {
  // register the local provider always

  console.log('Registering auth providers: ');
  const localStrategy = getLocalAuthStrategy();
  console.log('  local');
  passport.use('local', localStrategy);

  // register any other providers from the config
  const providers = getAuthProviderConfig();
  if (!providers) {
    return {};
  }
  Object.entries(providers).forEach(([providerId, config]) => {
    console.log(`  ${config.displayName} (${config.type})`);
    if (config.type === 'google') {
      const strategy = googleStrategyGenerator(
        config as GoogleAuthProviderConfig
      );
      passport.use(providerId, strategy);
    } else if (config.type === 'oidc') {
      const strategy = oidcStrategyGenerator(config as OIDCAuthProviderConfig);
      passport.use(providerId, strategy);
    }
  });
  return providers;
};
