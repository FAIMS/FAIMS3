import {z} from 'zod';
import {FALSEY_STRINGS, TRUTHY_STRINGS} from './env-coercion.js';

// Authentication Providers
// ========================
// Canonical auth-provider config types shared by every consumer (API, app,
// web, CDK, mobile build). This is the single source of truth - do not keep
// parallel copies in a consumer package.
//
// The schema is JSON shaped: arrays and booleans use their native JSON types.
// readAuthProviderConfigFromEnv coerces the raw AUTH_* env strings (CSV arrays,
// string booleans, numeric strings) into these native types before validation,
// so the same schema works for both a JSON config and generated env vars.
//
// Secrets (clientID / clientSecret / idpPublicKey) are optional here: the
// committed shared core leaves them empty and they are resolved per platform
// (SOPS for mobile/local, AWS Secrets Manager for the CDK) before the env is
// generated.

const callbackMethodSchema = z.enum(['GET', 'POST']);

// Base schema for common fields across all providers
export const BaseAuthProviderConfigSchema = z.object({
  id: z.string(),
  index: z.number().optional(), // order for display in UI
  type: z.string(),
  displayName: z.string(),
  helperText: z.string().optional(),
  scope: z.array(z.string()),
  /** HTTP methods accepted for the auth callback. Default: ['GET'] */
  callbackMethods: z.array(callbackMethodSchema).default(['GET']),
});
export type BaseAuthProviderConfig = z.infer<
  typeof BaseAuthProviderConfigSchema
>;

// Google auth provider schema
export const GoogleAuthProviderConfigSchema =
  BaseAuthProviderConfigSchema.extend({
    type: z.literal('google'),
    // Optional: in the shared core these are typically empty (secrets live in
    // core.secrets.auth.authProviders.<id>, resolved per platform - SOPS for
    // mobile/local, AWS Secrets Manager for the CDK).
    clientID: z.string().optional(),
    clientSecret: z.string().optional(),
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
    // Optional: secrets live in core.secrets.auth.authProviders.<id>.
    clientID: z.string().optional(),
    clientSecret: z.string().optional(),
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
    /** HTTP methods accepted for the auth callback. Default: ['POST'] */
    callbackMethods: z.array(callbackMethodSchema).default(['POST']),
    // Required fields
    /** IdP SSO URL - where to send authentication requests */
    entryPoint: z.string(),
    /** Service Provider entity ID - identifies your application to the IdP */
    issuer: z.string(),
    // Callback configuration
    /** Full callback URL for SAML responses */
    callbackURL: z.string().optional(),
    /** Callback path if callbackURL not specified (default: /saml/callback) */
    path: z.string().optional(),
    /**
     * How the SP sends the AuthnRequest to the IdP (passport-saml `authnRequestBinding`).
     * `HTTP-POST` (default): HTML form auto-post to IdP (POST binding for outbound auth request).
     * `HTTP-Redirect`: 302 to IdP with SAMLRequest query param.
     */
    authnRequestBinding: z
      .enum(['HTTP-Redirect', 'HTTP-POST'])
      .optional()
      .default('HTTP-POST'),
    /**
     * When true, passport-saml does not DEFLATE-compress outbound SAMLRequest /
     * LogoutRequest before base64 (required by some IdPs e.g. VANguard FAS).
     */
    skipRequestCompression: z.boolean().optional(),
    /** Sign the metadata document with PK? Default: false */
    signMetadata: z.boolean().default(false),
    // SP signing/decryption keys (PEM format) - from secrets
    /** SP private key for signing requests */
    privateKey: z.string().optional(),
    /** SP public key (included in metadata for IdP to validate our signatures) */
    publicKey: z.string().optional(),
    // IdP certificate (can come from config or secrets)
    /** IdP public certificate for verifying IdP signatures */
    idpPublicKey: z.string().optional(),
    // SP signing/decryption behavior
    /** Use the SP private key to decrypt IdP assertions (default: true) */
    enableDecryptionPvk: z.boolean().optional(),
    // Signature configuration
    /** Signature algorithm: 'sha1', 'sha256', or 'sha512' (default: sha256) */
    signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
    /** Digest for signed request references; passport-saml defaults to sha1 if omitted here */
    digestAlgorithm: z
      .enum(['sha1', 'sha256', 'sha512'])
      .optional()
      .default('sha256'),
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
    logoutURL: z.string().optional(),
    /** SP logout callback URL */
    logoutCallbackURL: z.string().optional(),
    // IdP validation
    /** Expected IdP issuer for logout validation */
    idpIssuer: z.string().optional(),
    /** Expected SAML response Audience */
    audience: z.string().optional(),
    /**
     * If set, used as SPSSODescriptor @errorURL in SAML metadata instead of the
     * default Conductor URL for this provider's SSO error page.
     */
    metadataErrorURL: z.string().optional(),
    /** Optional overrides for the per-provider SSO error page (`/auth/{id}/sso-error`) */
    ssoErrorPageTitle: z.string().optional(),
    ssoErrorPageHeading: z.string().optional(),
    ssoErrorPageLead: z.string().optional(),
    /** Optional Markdown body (rendered with the markdown helper) */
    ssoErrorPageDetailMarkdown: z.string().optional(),
    ssoErrorPageReturnURL: z.string().optional(),
    ssoErrorPageReturnLabel: z.string().optional(),
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

export const AuthProviderConfigMapSchema = z.record(
  z.string(),
  AuthProviderSchema
);
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

const AUTH_PREFIX = 'AUTH_';
const AUTH_ENV_PATTERN = /^AUTH_([A-Z0-9]+)_([A-Z0-9_]+)?$/;
const TRUTHY_SET = new Set<string>(TRUTHY_STRINGS);
const FALSEY_SET = new Set<string>(FALSEY_STRINGS);

const snakeToCamel = (str: string): string => {
  const exceptions = ['ID', 'URL'];
  const parts = str.split('_');
  const almost = parts
    .map(part => {
      if (exceptions.includes(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
  return almost.charAt(0).toLowerCase() + almost.slice(1);
};

const camelToSnake = (str: string): string => {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
};

function getPropertyType(
  property: string
): 'array' | 'boolean' | 'number' | 'string' {
  let isArray = false;
  let isBoolean = false;
  let isNumber = false;

  AuthProviderSchema.options.some(schema => {
    const shape = schema.shape as Record<string, z.ZodSchema>;
    if (property in shape) {
      const fieldSchema = shape[property];
      // Unwrap any optional / default wrapper to reach the underlying type so
      // that .default() fields (e.g. callbackMethods, signMetadata) are still
      // detected as arrays / booleans rather than falling back to string.
      let unwrapped: z.ZodType = fieldSchema as unknown as z.ZodType;
      while (
        unwrapped instanceof z.ZodOptional ||
        unwrapped instanceof z.ZodDefault
      ) {
        unwrapped = unwrapped.unwrap() as unknown as z.ZodType;
      }

      isArray = unwrapped instanceof z.ZodArray;
      isBoolean = unwrapped instanceof z.ZodBoolean;
      isNumber = unwrapped instanceof z.ZodNumber;
      return true;
    }
    return false;
  });

  if (isArray) return 'array';
  if (isBoolean) return 'boolean';
  if (isNumber) return 'number';
  return 'string';
}

export function readAuthProviderConfigFromEnv(
  env: Record<string, string | undefined>
): AuthProviderConfigMap {
  const envVars = Object.entries(env).filter(([key]) =>
    key.startsWith(AUTH_PREFIX)
  );
  const parsedConfig: Record<string, Record<string, unknown>> = {};

  for (const [key, value] of envVars) {
    const match = key.match(AUTH_ENV_PATTERN);
    if (!match) {
      continue;
    }

    const provider = match[1].toLowerCase();
    const property = snakeToCamel(match[2]);

    if (!parsedConfig[provider]) {
      parsedConfig[provider] = {id: provider};
    }

    const propertyType = getPropertyType(property);
    if (propertyType === 'array') {
      parsedConfig[provider][property] = (value ?? '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
      continue;
    }

    if (propertyType === 'boolean') {
      // D3 boolean vocabulary (see env-coercion). Strict: an unrecognised
      // value is dropped so the provider-level schema reports it, rather than
      // being silently coerced to false.
      const lower = (value ?? '').trim().toLowerCase();
      if (TRUTHY_SET.has(lower)) {
        parsedConfig[provider][property] = true;
      } else if (FALSEY_SET.has(lower)) {
        parsedConfig[provider][property] = false;
      }
      continue;
    }

    if (propertyType === 'number') {
      // Strict: only set a finite integer. A blank / non-numeric value is
      // omitted so the schema surfaces it, instead of silently becoming 0.
      const n = Number.parseInt(value ?? '', 10);
      if (Number.isFinite(n)) {
        parsedConfig[provider][property] = n;
      }
      continue;
    }

    parsedConfig[provider][property] = value;
  }

  let index = 100;
  for (const provider of Object.values(parsedConfig)) {
    if (provider.index === undefined) {
      provider.index = index;
      index += 1;
    }
  }

  const typed: AuthProviderConfigMap = {};
  for (const [providerId, provider] of Object.entries(parsedConfig)) {
    const parsed = AuthProviderSchema.safeParse(provider);
    if (!parsed.success) {
      // Do not silently drop a misconfigured provider — surface it.
      console.warn(
        `Warning: dropping auth provider '${providerId}': invalid configuration.`,
        parsed.error.issues
      );
      continue;
    }
    typed[providerId] = parsed.data;
  }

  return typed;
}

function providerIdToEnvProvider(providerId: string): string {
  return providerId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function serializeEnvValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).join(',');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

export function buildAuthProviderEnvMap(
  providers: AuthProviderConfigMap
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [providerId, provider] of Object.entries(providers)) {
    const envProvider = providerIdToEnvProvider(providerId);
    for (const [property, value] of Object.entries(provider)) {
      if (property === 'id') {
        continue;
      }

      const envKey = `${AUTH_PREFIX}${envProvider}_${camelToSnake(property)}`;
      env[envKey] = serializeEnvValue(value);
    }
  }

  return env;
}
