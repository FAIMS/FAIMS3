import {z} from 'zod';
import {Permission, Role, roleDetails, RoleScope} from './model';
import {PeopleDBDocument} from '../data_storage';
import {drillRolePermissions} from './helpers';

// ==============
// TOKEN ENCODING
// ==============

export const ENCODING_SEPARATOR = '||';

// This is configurable, but it's fine to use the default
export const COUCHDB_PERMISSIONS_PATH = '_couchdb.roles';

export const decodePerResourcePermission = ({
  input,
}: {
  input: string;
}): {
  resourceId: string;
  permissionString: string;
} => {
  const splitResult = input.split(ENCODING_SEPARATOR);
  if (
    splitResult.length !== 2 ||
    splitResult[0].length === 0 ||
    splitResult[1].length === 0
  ) {
    throw Error(
      'Invalid decoding of encoded resource specific role. After splitting on ' +
        ENCODING_SEPARATOR +
        ' there was not two distinct remaining sections of non zero length.'
    );
  }
  return {resourceId: splitResult[0], permissionString: splitResult[1]};
};

// =======================================
// Zod schemas for raw token structure
// =======================================

// Input schema for the raw TokenStructure
const rawTokenSchema = z.object({
  // Encoded resource permissions OR global permissions available to couch
  // functions. Here we include ONLY permissions - not roles - as we want couch
  // to not have to dispatch roles -> permissions
  [COUCHDB_PERMISSIONS_PATH]: z.array(z.string()),
  // These are roles which apply to specific resources (encoded as above) - NOT
  // visible in couch
  resourceRoles: z.array(z.string()),
  // These are roles that apply generally - not resource specific - they may
  // imply resources specific permissions but for all resources of that type -
  // NOT visible in couch
  globalRoles: z.array(z.string()),
});
export type EncodedTokenPermissions = z.infer<typeof rawTokenSchema>;

// =======================================
// Zod schemas for decoded token structure
// =======================================

// Schema for a decoded resource role
const decodedResourceRoleSchema = z.object({
  resourceId: z.string().min(1),
  role: z.nativeEnum(Role),
});
export type ResourceRole = z.infer<typeof decodedResourceRoleSchema>;

// Schema for a general role
const globalRoleSchema = z.nativeEnum(Role);

// Complete decoded token structure
const decodedTokenSchema = z.object({
  resourceRoles: z.array(decodedResourceRoleSchema),
  globalRoles: z.array(globalRoleSchema),
});

// Export the type for the decoded token
export type DecodedTokenPermissions = z.infer<typeof decodedTokenSchema>;

/**
 * Transforms and validates an encoded TokenStructure into a more usable DecodedToken
 * @param encodedToken The raw encoded TokenStructure
 * @returns A validated DecodedToken with properly parsed roles and permissions
 */
export function decodeAndValidateToken(
  encodedToken: EncodedTokenPermissions
): DecodedTokenPermissions {
  // First validate the raw token structure
  const validatedRawToken = rawTokenSchema.parse(encodedToken);

  // Transform and decode resource roles
  const resourceRoles = validatedRawToken.resourceRoles.map(encodedRole => {
    try {
      const {resourceId, permissionString} = decodePerResourcePermission({
        input: encodedRole,
      });

      return {
        resourceId,
        role: permissionString,
      };
    } catch (error: any) {
      throw new Error(
        `Invalid resource role encoding: ${encodedRole}. ${error.message}`
      );
    }
  });

  // Transform general roles
  const globalRoles = validatedRawToken.globalRoles;

  // Create the decoded token
  const decodedToken = {
    resourceRoles,
    globalRoles,
  };

  // Validate the decoded token against the schema
  return decodedTokenSchema.parse(decodedToken);
}

/**
 * Encodes a decoded token back into the raw TokenStructure format
 * @param decodedToken The decoded token
 * @returns The encoded TokenStructure
 */
export function encodeToken(
  decodedToken: DecodedTokenPermissions
): EncodedTokenPermissions {
  // Validate the decoded token first
  decodedTokenSchema.parse(decodedToken);

  // Encode resource roles
  const resourceRoles = decodedToken.resourceRoles.map(
    ({resourceId, role}) => `${resourceId}${ENCODING_SEPARATOR}${role}`
  );

  // Encode resource permissions - collect them all
  const allPermissions: string[] = [];

  // For each resource specific role, drill down into all permissions, and add
  // to the all permissions list per resource
  decodedToken.resourceRoles.forEach(({resourceId, role}) => {
    const permissions = drillRolePermissions({
      role,
    });
    allPermissions.concat(
      permissions.map(p => `${resourceId}${ENCODING_SEPARATOR}${p}`)
    );
  });
  decodedToken.globalRoles.forEach(role => {
    const permissions = drillRolePermissions({
      role,
    });
    // These are not encoded since they are global
    allPermissions.concat(permissions);
  });

  // General roles don't need special encoding
  const globalRoles = decodedToken.globalRoles.map(role => role.toString());

  return {
    [COUCHDB_PERMISSIONS_PATH]: allPermissions,
    resourceRoles,
    globalRoles,
  };
}

/**
 *
 * Takes a couch user and builds an encoded token.
 *
 * This is achieved by first building a decoded token object from the couch
 * user, then using the encode token function to encode it. This involves
 * drilling out permissions only where necessary for couch to be satisfied.
 *
 * @returns encoded token object (to be signed/added other details)
 */
export function couchUserToTokenPermissions({
  globalRoles,
  resourceRoles,
}: PeopleDBDocument): EncodedTokenPermissions {
  // Flatten the resource mapped roles into a big list
  let allResourceRoles: ResourceRole[] = [];
  for (const specificResourceRoles of Object.values(resourceRoles)) {
    if (specificResourceRoles) {
      allResourceRoles = allResourceRoles.concat(specificResourceRoles);
    }
  }
  return encodeToken({globalRoles, resourceRoles: allResourceRoles});
}
