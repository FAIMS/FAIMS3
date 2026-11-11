// SPDX-License-Identifier: Apache-2.0
import passport from 'passport';
import {
  AuthProviderConfig,
  BaseAuthProviderConfig,
  RuntimeAuthProviderConfigMap,
} from '@faims3/build-config';
import {googleStrategyGenerator} from './googleStrategy';
import {getLocalAuthStrategy} from './localStrategy';
import {oidcStrategyGenerator} from './oidcStrategy';
import {samlStrategyGenerator} from './samlStrategy';
import {config} from '../../buildconfig';

/** Auth providers already parsed by `parseApiEnv` (AUTH_* env). */
export const getAuthProviderConfig = (): RuntimeAuthProviderConfigMap => {
  return config.authProviderConfig;
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

// Type for the return value containing both config and strategy
export type RegisteredAuthProvider = {
  config: AuthProviderConfig;
  strategy: passport.Strategy;
};

export type RegisteredAuthProviders = Record<string, RegisteredAuthProvider>;

export const registerAuthProviders = (): RegisteredAuthProviders => {
  // register the local provider always
  console.log('Registering auth providers: ');

  if (config.localLoginEnabled) {
    const localStrategy = getLocalAuthStrategy();
    console.log('  local');
    passport.use('local', localStrategy);
  }

  const registeredProviders: RegisteredAuthProviders = {};

  // register any other providers from the config
  const providers = getAuthProviderConfig();

  Object.entries(providers).forEach(([providerId, config]) => {
    console.log(`  ${config.displayName} (${config.type})`);

    let strategy: passport.Strategy;

    if (config.type === 'google') {
      strategy = googleStrategyGenerator(config);
    } else if (config.type === 'oidc') {
      strategy = oidcStrategyGenerator(config);
    } else if (config.type === 'saml') {
      strategy = samlStrategyGenerator(config) as passport.Strategy;
    } else {
      const unexpected: never = config;
      console.warn(`Unknown auth provider type: ${String(unexpected)}`);
      return;
    }

    // Register with passport
    passport.use(providerId, strategy);

    // Store both config and strategy for later use
    registeredProviders[providerId] = {
      config,
      strategy,
    };
  });

  return registeredProviders;
};
