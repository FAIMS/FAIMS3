import passport from 'passport';
import {oidcStrategyGenerator} from './oidcStrategy';
import {googleStrategyGenerator} from './googleStrategy';
import {existsSync, readFileSync} from 'fs';
import {getLocalAuthStrategy} from './localStrategy';
import {
  AuthProviderConfigMap,
  AuthProviderConfigMapSchema,
  AuthProviderSchema,
  BaseAuthProviderConfig,
  GoogleAuthProviderConfig,
  OIDCAuthProviderConfig,
} from './strategyTypes';
import {z} from 'zod';

// Convert a SNAKE_CASE identifier to camelCase with a few exceptions
const snakeToCamel = (str: string): string => {
  const exceptions = ['ID', 'URL'];
  const parts = str.split('_');
  // split and capitalise each part unless it's in the exceptions list
  const almost = parts
    .map(part => {
      if (exceptions.includes(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
  // lowercase the first character
  return almost.charAt(0).toLowerCase() + almost.slice(1);
};

// A version of the above that builds the config from environment variables
export const readAuthProviderConfigFromEnv =
  (): AuthProviderConfigMap | null => {
    // Gather env variables that start with AUTH_
    const envVars = Object.entries(process.env).filter(([key, _]) =>
      key.startsWith('AUTH_')
    );
    const config: Record<string, any> = {};

    // parse the environment variables to get the provider/property/value triples
    // Expected format: AUTH_{PROVIDER}_{PROPERTY} or
    //                 AUTH_{PROVIDER}_{PROPERTY}_N for array properties
    const pattern = /^AUTH_([A-Z0-9]+)_([A-Z0-9_]+)?$/;
    envVars.forEach(([key, value]) => {
      const match = key.match(pattern);
      if (match) {
        const provider = match[1].toLowerCase();
        const property = snakeToCamel(match[2]);
        // look at the zod schema to see if this property is an array type
        const isArray = AuthProviderSchema.options.some(schema => {
          const shape = schema.shape as Record<string, z.ZodSchema>;
          if (property in shape) {
            // Check if this schema is for our provider type
            return shape[property] instanceof z.ZodArray;
          }
          return false;
        });
        // initialise the provider if we haven't already
        if (!config[provider]) {
          config[provider] = {id: provider};
        }

        if (isArray) {
          // simple split on commas and trim the values
          config[provider][property] = value?.split(',').map(v => v.trim());
        } else {
          config[provider][property] = value;
        }
      } else {
        console.warn(`Ignoring unrecognized env var: ${key}`);
      }
    });
    // add an index to each provider if there isn't already one
    let index = 100;
    Object.values(config).forEach((provider: BaseAuthProviderConfig) => {
      if (provider.index === undefined) {
        provider.index = index;
        index += 1;
      } else {
        // coerce to a number
        provider.index = parseInt(provider.index as any, 10);
      }
    });

    const parsed = AuthProviderConfigMapSchema.safeParse(config);
    if (!parsed.success) {
      console.error(
        'Error parsing auth provider config from env: ',
        JSON.stringify(parsed.error.format(), null, 2)
      );
      return null;
    }
    return parsed.success ? parsed.data : null;
  };

// read once and store the result
const AUTH_PROVIDER_CONFIG = readAuthProviderConfigFromEnv();

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
