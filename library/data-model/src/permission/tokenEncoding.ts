import {z} from 'zod';
import {Role} from './model';

// ==============
// TOKEN ENCODING
// ==============

export const ENCODING_SEPARATOR = '||';
export const COUCH_ADMIN_ROLE_NAME = '_admin';

// This is configurable, but it's fine to use the default
export const COUCHDB_ROLES_PATH = '_couchdb.roles';

/**
 * Decodes a resource-specific role string from the format "resourceId||role"
 *
 * @param input The encoded string containing resourceId and role separated by
 * the encoding separator
 * @returns An object containing the separated resourceId and claimString (role)
 * @throws Error if the input string does not contain exactly two non-empty
 * parts separated by the encoding separator
 */
export const decodePerResourceStatement = ({
  input,
}: {
  input: string;
}): {
  resourceId: string;
  claimString: string;
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
  return {resourceId: splitResult[0], claimString: splitResult[1]};
};

// =======================================
// Zod schemas for encoded token structure
// =======================================

// Input schema for the raw TokenStructure
const tokenPermissionsSchema = z.object({
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

const tokenPayloadSchema = z
  .object({
    // The name of the user - this is the full display name
    name: z.string(),
    // The server which generated this token - this is the URL
    server: z.string(),
  })
  .merge(tokenPermissionsSchema);
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

// =======================================
// Zod schemas for decoded token structure
// =======================================

// Schema for a decoded resource role
const decodedResourceRoleSchema = z.object({
  resourceId: z.string().min(1),
  role: z.nativeEnum(Role),
});
export type ResourceRole = z.infer<typeof decodedResourceRoleSchema>;

// Schema for a global role
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
 * @returns A validated DecodedToken with properly parsed roles
 */
export function decodeAndValidateToken(
  encodedToken: TokenPermissions
): DecodedTokenPermissions {
  // First validate the raw token structure
  const validatedRawToken = tokenPermissionsSchema.parse(encodedToken);

  // Transform and decode resource roles
  const resourceRoles = validatedRawToken.resourceRoles.map(encodedRole => {
    try {
      const {resourceId, claimString: roleString} = decodePerResourceStatement({
        input: encodedRole,
      });

      return {
        resourceId,
        role: roleString,
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
 * Encodes a role claim into a token - including separator if needed for
 * resource scoped role
 * @returns string encoding
 */
export const encodeClaim = ({
  resourceId,
  claim,
}: {
  resourceId?: string;
  claim: string;
}): string => {
  return `${resourceId ?? ''}${resourceId ? ENCODING_SEPARATOR : ''}${claim}`;
};

/**
 * Encodes a decoded token back into the raw TokenStructure format
 *
 * @param decodedToken The decoded token
 * @returns The encoded TokenStructure
 */
export function encodeToken(
  decodedToken: DecodedTokenPermissions
): TokenPermissions {
  // Validate the decoded token first
  decodedTokenSchema.parse(decodedToken);

  // Encode resource roles
  const resourceRoles = decodedToken.resourceRoles.map(({resourceId, role}) =>
    encodeClaim({resourceId, claim: role})
  );

  // Generate CouchDB roles list - this contains both:
  // 1. Global roles (as is)
  // 2. Resource-specific roles (in the format resourceId||role)\

  // CouchDB will use these for authorization
  const couchDbRoles = [...decodedToken.globalRoles, ...resourceRoles];

  // General roles don't need special encoding
  const globalRoles = decodedToken.globalRoles.map(role => role.toString());

  return {
    [COUCHDB_ROLES_PATH]: couchDbRoles,
    resourceRoles,
    globalRoles,
  };
}
