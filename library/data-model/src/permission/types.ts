// =======================================
// Zod schemas for encoded token structure
// =======================================

import {z} from 'zod';
import {COUCHDB_ROLES_PATH} from '../constants';
import {Role} from './model';

// Input schema for the raw TokenStructure
export const tokenPermissionsSchema = z.object({
  // Encoded resource roles OR global roles available to couch
  // functions. Here we include roles that CouchDB needs for authorization.
  [COUCHDB_ROLES_PATH]: z.array(z.string()),
  // These are roles which apply to specific resources (encoded as above) - NOT
  // visible in couch. NOTE: TEAMS and other associative roles are drilled into
  // this resource roles list
  resourceRoles: z.array(z.string()),
  // These are roles that apply generally - not resource specific - they may
  // imply resources specific actions but for all resources of that type -
  // NOT visible in couch
  globalRoles: z.array(z.string()),
});
export type TokenPermissions = z.infer<typeof tokenPermissionsSchema>;

export const tokenPayloadSchema = z
  .object({
    // The name of the user - this is the full display name
    name: z.string(),
    // The server which generated this token - this is the URL
    server: z.string(),
    // username
    username: z.string(),
  })
  .merge(tokenPermissionsSchema);
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

export interface TokenContents extends DecodedTokenPermissions {
  // First/last name
  name?: string;
  // Username (i.e. email)
  username: string;
  // Server generating
  server: string;
  // This is required now - all tokens must have an expiry
  exp: number;
}

// =======================================
// Zod schemas for decoded token structure
// =======================================

// Schema for a decoded resource role
export const decodedResourceRoleSchema = z.object({
  resourceId: z.string().min(1),
  role: z.nativeEnum(Role),
});
export type ResourceRole = z.infer<typeof decodedResourceRoleSchema>;

// Schema for a global role
export const globalRoleSchema = z.nativeEnum(Role);

// Complete decoded token structure
export const decodedTokenSchema = z.object({
  resourceRoles: z.array(decodedResourceRoleSchema),
  globalRoles: z.array(globalRoleSchema),
});

// Export the type for the decoded token
export type DecodedTokenPermissions = z.infer<typeof decodedTokenSchema>;
