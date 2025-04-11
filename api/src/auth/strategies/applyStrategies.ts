import passport from 'passport';
import {Strategy} from 'passport-oauth2';
import {AuthProvider, CONDUCTOR_PUBLIC_URL} from '../../buildconfig';
import {getGoogleOAuthStrategy} from './googleStrategy';
import {getLocalAuthStrategy} from './localStrategy';

// This function takes the callback URL and generates the passport strategy
export type StrategyGeneratorFunction = (params: {
  loginCallbackUrl: string;
  scope: string[];
}) => Strategy;

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
export const AUTH_PROVIDER_DETAILS: Record<AuthProvider, ProviderDetails> = {
  [AuthProvider.GOOGLE]: {
    id: 'google',
    displayName: 'Google',
    relativeLoginCallbackUrl: '/auth-return/google',
    fullLoginCallbackUrl: `${CONDUCTOR_PUBLIC_URL}/auth-return/google`,
    strategyGenerator: getGoogleOAuthStrategy,
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
  },
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
