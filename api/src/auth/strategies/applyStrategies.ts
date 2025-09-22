import passport from 'passport';
import {AuthProvider, CONDUCTOR_PUBLIC_URL} from '../../buildconfig';
import {getLocalAuthStrategy} from './localStrategy';
import {getGoogleOAuthStrategy} from './googleStrategy';
import {OIDCStragetyGenerator} from './oidcStrategy';

// This function takes the callback URL and generates the passport strategy
export type StrategyGeneratorFunction = (params: {
  loginCallbackUrl: string;
  scope: string[];
}) => passport.Strategy;

// This is a set of configuration details for a provider
export type ProviderDetails = {
  id: string;
  displayName: string;
  relativeLoginCallbackUrl: string;
  fullLoginCallbackUrl: string;
  strategyGenerator: StrategyGeneratorFunction;
  scope: string[];
};

// This maps the provider name/enum -> details about it
const AUTH_PROVIDER_DETAILS: Record<AuthProvider, ProviderDetails> =
  {} as Record<AuthProvider, ProviderDetails>;

export const registerAuthProvider = (
  providerName: AuthProvider,
  provider: ProviderDetails
) => {
  AUTH_PROVIDER_DETAILS[provider.id as AuthProvider] = provider;
};

export const getAuthProviderDetails = (
  providerName: AuthProvider
): ProviderDetails => {
  return AUTH_PROVIDER_DETAILS[providerName];
};

/**
 * Register strategies using `passport.use`,
 * Social provider identifiers must appear in the AVAILABLE_AUTH_PROVIDERS
 *
 * @param providersToUse array of provider identifiers
 */
export function applyPassportStrategies(providersToUse: AuthProvider[]) {
  // Local is always enabled
  passport.use('local', getLocalAuthStrategy());

  // For each provider
  for (const providerName of providersToUse) {
    // Get the function which generates the strategy

    const {
      strategyGenerator,
      fullLoginCallbackUrl: loginCallbackUrl,
      scope,
      id,
    } = AUTH_PROVIDER_DETAILS[providerName];

    // Build the strategy, providing the login callback URL
    const strategy = strategyGenerator({
      loginCallbackUrl,
      scope,
    });

    // Register the strategy generated
    passport.use(id, strategy);
  }
}

// Register providers here - forces import of the strategies and ensures the
// registration happens on startup

registerAuthProvider(AuthProvider.GOOGLE, {
  id: AuthProvider.GOOGLE,
  displayName: 'Google',
  relativeLoginCallbackUrl: '/auth-return/google',
  fullLoginCallbackUrl: `${CONDUCTOR_PUBLIC_URL}/auth-return/google`,
  strategyGenerator: getGoogleOAuthStrategy,
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
});

const AAF_ISSUER = 'https://central.test.aaf.edu.au';

registerAuthProvider(AuthProvider.AAF, {
  id: AuthProvider.AAF,
  displayName: 'AAF',
  relativeLoginCallbackUrl: '/auth-return/aaf',
  fullLoginCallbackUrl: `${CONDUCTOR_PUBLIC_URL}/auth-return/aaf`,
  strategyGenerator: OIDCStragetyGenerator({
    strategyId: AuthProvider.AAF,
    displayName: 'AAF',
    issuer: AAF_ISSUER,
    authorizationURL: `${AAF_ISSUER}/oidc/authorize`,
    tokenURL: `${AAF_ISSUER}/oidc/token`,
    userInfoURL: `${AAF_ISSUER}/oidc/userinfo`,
    clientID: process.env.AAF_CLIENT_ID!,
    clientSecret: process.env.AAF_CLIENT_SECRET!,
  }),
  scope: ['profile', 'email'],
});
