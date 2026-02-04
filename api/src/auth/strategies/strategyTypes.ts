import {z} from 'zod';

// Authentication Providers
// ========================
// Configuration for auth providers is read from environment variables and made available
// to the app using the following interfaces.

// Base schema for common fields across all providers
export const BaseAuthProviderConfigSchema = z.object({
  id: z.string(),
  index: z.number().optional(), // order for display in UI
  type: z.string(),
  displayName: z.string(),
  helperText: z.string().optional(),
  scope: z.array(z.string()),
  /** HTTP methods accepted for the auth callback. Default: ['GET'] */
  callbackMethods: z
    .array(z.enum(['GET', 'POST']))
    .optional()
    .default(['GET'])
    .describe('HTTP methods accepted for the auth return callback'),
});
export type BaseAuthProviderConfig = z.infer<
  typeof BaseAuthProviderConfigSchema
>;

// Google auth provider schema
export const GoogleAuthProviderConfigSchema =
  BaseAuthProviderConfigSchema.extend({
    type: z.literal('google'),
    clientID: z.string(),
    clientSecret: z.string(),
  });
export type GoogleAuthProviderConfig = z.infer<
  typeof GoogleAuthProviderConfigSchema
>;

// OIDC auth provider schema
export const OIDCAuthProviderConfigSchema = BaseAuthProviderConfigSchema.extend(
  {
    type: z.literal('oidc'),
    issuer: z.string(),
    authorizationURL: z.string(),
    tokenURL: z.string(),
    userInfoURL: z.string(),
    clientID: z.string(),
    clientSecret: z.string(),
  }
);
export type OIDCAuthProviderConfig = z.infer<
  typeof OIDCAuthProviderConfigSchema
>;

/**
 * SAML auth provider schema (with secrets merged)
 *
 * Based on passport-saml configuration options.
 * See https://www.passportjs.org/packages/passport-saml/ for details.
 */
export const SAMLAuthProviderConfigSchema = BaseAuthProviderConfigSchema.extend(
  {
    type: z.literal('saml'),
    // Override default callback method to just POST
    callbackMethods: z
      .array(z.enum(['GET', 'POST']))
      .optional()
      .default(['POST'])
      .describe('HTTP methods accepted for the auth return callback'),
    // Required fields
    /** IdP SSO URL - where to send authentication requests */
    entryPoint: z.string(),
    /** Service Provider entity ID - identifies your application to the IdP */
    issuer: z.string(),
    // Callback configuration
    /** Full callback URL for SAML responses */
    callbackUrl: z.string().optional(),
    /** Callback path if callbackUrl not specified (default: /saml/callback) */
    path: z.string().optional(),
    /** Sign the metadata document with PK? */
    signMetadata: z
      .string()
      .optional()
      .default('false')
      .transform(val => val.toUpperCase() === 'TRUE'),
    // SP signing/decryption keys (PEM format) - from secrets
    /** SP private key for signing requests */
    privateKey: z.string().optional(),
    /** SP public key (included in metadata for IdP to validate our signatures) */
    publicKey: z.string().optional(),
    // IdP certificate (can come from config or secrets)
    /** IdP public certificate for verifying IdP signatures */
    idpPublicKey: z.string(),
    // SP signing/decryption behavior
    /** Use the SP private key to decrypt IdP assertions (default: true) */
    enableDecryptionPvk: z.boolean().optional(),
    // Signature configuration
    /** Signature algorithm: 'sha1', 'sha256', or 'sha512' (default: sha256) */
    signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
    /** Digest algorithm: 'sha1', 'sha256', or 'sha512' */
    digestAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
    /** Request signed assertions from IdP (default: true) */
    wantAssertionsSigned: z.boolean().optional(),
    // SAML behavior options
    /** NameID format to request from IdP */
    identifierFormat: z.string().optional(),
    /** Authentication context class(es) to request */
    authnContext: z.union([z.string(), z.array(z.string())]).optional(),
    /** Set true for ADFS compatibility */
    disableRequestedAuthnContext: z.boolean().optional(),
    /** Force re-authentication even with valid session */
    forceAuthn: z.boolean().optional(),
    // Validation options
    /** Allowed clock skew in ms for NotBefore/NotOnOrAfter (-1 to disable, default: 0) */
    acceptedClockSkewMs: z.number().optional(),
    /** Max age of assertions in ms */
    maxAssertionAgeMs: z.number().optional(),
    /** Validate InResponseTo to prevent replay attacks */
    validateInResponseTo: z.boolean().optional(),
    /** How long request IDs are valid in ms (default: 8 hours) */
    requestIdExpirationPeriodMs: z.number().optional(),
    // Logout
    /** IdP logout URL (defaults to entryPoint) */
    logoutUrl: z.string().optional(),
    /** SP logout callback URL */
    logoutCallbackUrl: z.string().optional(),
    // IdP validation
    /** Expected IdP issuer for logout validation */
    idpIssuer: z.string().optional(),
    /** Expected SAML response Audience */
    audience: z.string().optional(),
  }
);

export type SAMLAuthProviderConfig = z.infer<
  typeof SAMLAuthProviderConfigSchema
>;

// Create a discriminated union of all auth provider schemas
export const AuthProviderSchema = z.discriminatedUnion('type', [
  GoogleAuthProviderConfigSchema,
  OIDCAuthProviderConfigSchema,
  SAMLAuthProviderConfigSchema,
]);
export type AuthProviderConfig = z.infer<typeof AuthProviderSchema>;

export const AuthProviderConfigMapSchema = z.record(AuthProviderSchema);
export type AuthProviderConfigMap = z.infer<typeof AuthProviderConfigMapSchema>;

// Type guard functions for runtime type checking
export function isGoogleProvider(
  config: AuthProviderConfig
): config is GoogleAuthProviderConfig {
  return config.type === 'google';
}

export function isOIDCProvider(
  config: AuthProviderConfig
): config is OIDCAuthProviderConfig {
  return config.type === 'oidc';
}

export function isSAMLProvider(
  config: AuthProviderConfig
): config is SAMLAuthProviderConfig {
  return config.type === 'saml';
}
