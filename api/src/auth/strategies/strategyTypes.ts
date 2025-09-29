import {z} from 'zod';

// Authentication Providers
// ========================
// Configuration for auth providers is read from a JSON file and made available
// to the app using the following interfaces.

// Base schema is really for Google - consider changing if we introduce other
// auth types in future
export const BaseAuthProviderConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string(),
  clientID: z.string(),
  clientSecret: z.string(),
  scope: z.array(z.string()),
});

export type BaseAuthProviderConfig = z.infer<
  typeof BaseAuthProviderConfigSchema
>;

// Google auth provider schema (using the base structure)
export const GoogleAuthProviderConfigSchema =
  BaseAuthProviderConfigSchema.extend({
    type: z.literal('google'),
  });

export type GoogleAuthProviderConfig = z.infer<
  typeof GoogleAuthProviderConfigSchema
>;

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

// Create a discriminated union of all auth provider schemas
export const AuthProviderSchema = z.discriminatedUnion('type', [
  GoogleAuthProviderConfigSchema,
  OIDCAuthProviderConfigSchema,
  // Add other provider schemas here as needed
]);

export const AuthProviderConfigMapSchema = z.record(AuthProviderSchema);

export type AuthProviderConfigMap = z.infer<typeof AuthProviderConfigMapSchema>;
