import {z} from 'zod';

const callbackMethodSchema = z.enum(['GET', 'POST']);

export const BaseAuthProviderConfigSchema = z.object({
  id: z.string(),
  index: z.number().optional(),
  type: z.string(),
  displayName: z.string(),
  helperText: z.string().optional(),
  scope: z.array(z.string()),
  callbackMethods: z.array(callbackMethodSchema).optional(),
});

export const GoogleAuthProviderConfigSchema =
  BaseAuthProviderConfigSchema.extend({
    type: z.literal('google'),
    clientID: z.string(),
    clientSecret: z.string(),
  });

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

export const SAMLAuthProviderConfigSchema = BaseAuthProviderConfigSchema.extend({
  type: z.literal('saml'),
  entryPoint: z.string(),
  issuer: z.string(),
  callbackURL: z.string().optional(),
  path: z.string().optional(),
  authnRequestBinding: z.enum(['HTTP-Redirect', 'HTTP-POST']).optional(),
  skipRequestCompression: z.boolean().optional(),
  signMetadata: z.boolean().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
  idpPublicKey: z.string(),
  enableDecryptionPvk: z.boolean().optional(),
  signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
  digestAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).optional(),
  wantAssertionsSigned: z.boolean().optional(),
  identifierFormat: z.string().optional(),
  authnContext: z.union([z.string(), z.array(z.string())]).optional(),
  disableRequestedAuthnContext: z.boolean().optional(),
  forceAuthn: z.boolean().optional(),
  acceptedClockSkewMs: z.number().optional(),
  maxAssertionAgeMs: z.number().optional(),
  validateInResponseTo: z.boolean().optional(),
  requestIdExpirationPeriodMs: z.number().optional(),
  logoutURL: z.string().optional(),
  logoutCallbackURL: z.string().optional(),
  idpIssuer: z.string().optional(),
  audience: z.string().optional(),
  metadataErrorURL: z.string().optional(),
  ssoErrorPageTitle: z.string().optional(),
  ssoErrorPageHeading: z.string().optional(),
  ssoErrorPageLead: z.string().optional(),
  ssoErrorPageDetailMarkdown: z.string().optional(),
  ssoErrorPageReturnURL: z.string().optional(),
  ssoErrorPageReturnLabel: z.string().optional(),
});

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

const AUTH_PREFIX = 'AUTH_';
const AUTH_ENV_PATTERN = /^AUTH_([A-Z0-9]+)_([A-Z0-9_]+)?$/;

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

function getPropertyType(property: string): 'array' | 'boolean' | 'number' | 'string' {
  let isArray = false;
  let isBoolean = false;
  let isNumber = false;

  AuthProviderSchema.options.some(schema => {
    const shape = schema.shape as Record<string, z.ZodSchema>;
    if (property in shape) {
      const fieldSchema = shape[property];
      const unwrapped =
        fieldSchema instanceof z.ZodOptional ? fieldSchema.unwrap() : fieldSchema;

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
  const envVars = Object.entries(env).filter(([key]) => key.startsWith(AUTH_PREFIX));
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
      parsedConfig[provider][property] =
        (value ?? '').toLowerCase() === 'true' || value === '1';
      continue;
    }

    if (propertyType === 'number') {
      parsedConfig[provider][property] = Number.parseInt(value ?? '0', 10);
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
