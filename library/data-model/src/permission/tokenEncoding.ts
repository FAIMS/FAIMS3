import {z} from 'zod';
import {Permission, Role} from './model';

// ==============
// TOKEN ENCODING
// ==============

export const ENCODING_SEPARATOR = '||';

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

export interface TokenStructure {
  // These are roles which apply to specific resources (encoded as above)
  resourceRoles: string[];
  // These are resource specific permissions e.g. (encoded as above)
  resourcePermissions: string[];
  // These are roles that apply generally - not resource specific - they may
  // imply resources specific permissions but for all resources of that type.
  globalRoles: string[];
}

// =======================================
// Zod schemas for raw token structure
// =======================================

// Input schema for the raw TokenStructure
const rawTokenSchema = z.object({
  resourceRoles: z.array(z.string()),
  resourcePermissions: z.array(z.string()),
  globalRoles: z.array(z.string()),
});

// =======================================
// Zod schemas for decoded token structure
// =======================================

// Schema for a decoded resource role
const decodedResourceRoleSchema = z.object({
  resourceId: z.string().min(1),
  role: z.nativeEnum(Role),
});

// Schema for a decoded resource permission
const decodedResourcePermissionSchema = z.object({
  resourceId: z.string().min(1),
  permission: z.nativeEnum(Permission),
});

// Schema for a general role
const globalRoleSchema = z.nativeEnum(Role);

// Complete decoded token structure
const decodedTokenSchema = z.object({
  resourceRoles: z.array(decodedResourceRoleSchema),
  resourcePermissions: z.array(decodedResourcePermissionSchema),
  globalRoles: z.array(globalRoleSchema),
});

// Export the type for the decoded token
export type DecodedToken = z.infer<typeof decodedTokenSchema>;

/**
 * Transforms and validates an encoded TokenStructure into a more usable DecodedToken
 * @param encodedToken The raw encoded TokenStructure
 * @returns A validated DecodedToken with properly parsed roles and permissions
 */
export function decodeAndValidateToken(
  encodedToken: TokenStructure
): DecodedToken {
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

  // Transform and decode resource permissions
  const resourcePermissions = validatedRawToken.resourcePermissions.map(
    encodedPermission => {
      try {
        const {resourceId, permissionString} = decodePerResourcePermission({
          input: encodedPermission,
        });

        return {
          resourceId,
          permission: permissionString,
        };
      } catch (error: any) {
        throw new Error(
          `Invalid resource permission encoding: ${encodedPermission}. ${error.message}`
        );
      }
    }
  );

  // Transform general roles
  const globalRoles = validatedRawToken.globalRoles.map(roleString => {
    return roleString;
  });

  // Create the decoded token
  const decodedToken = {
    resourceRoles,
    resourcePermissions,
    globalRoles: globalRoles,
  };

  // Validate the decoded token against the schema
  return decodedTokenSchema.parse(decodedToken);
}

/**
 * Encodes a decoded token back into the raw TokenStructure format
 * @param decodedToken The decoded token
 * @returns The encoded TokenStructure
 */
export function encodeToken(decodedToken: DecodedToken): TokenStructure {
  // Validate the decoded token first
  decodedTokenSchema.parse(decodedToken);

  // Encode resource roles
  const resourceRoles = decodedToken.resourceRoles.map(
    ({resourceId, role}) => `${resourceId}${ENCODING_SEPARATOR}${role}`
  );

  // Encode resource permissions
  const resourcePermissions = decodedToken.resourcePermissions.map(
    ({resourceId, permission}) =>
      `${resourceId}${ENCODING_SEPARATOR}${permission}`
  );

  // General roles don't need special encoding
  const globalRoles = decodedToken.globalRoles.map(role => role.toString());

  return {
    resourceRoles,
    resourcePermissions,
    globalRoles,
  };
}
