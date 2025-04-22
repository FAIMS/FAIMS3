import {ENCODING_SEPARATOR, COUCHDB_ROLES_PATH} from '../constants';
import {drillRoles, resourceRolesEqual} from './helpers';
import {
  TokenPermissions,
  DecodedTokenPermissions,
  decodedTokenSchema,
  tokenPermissionsSchema,
} from './types';

// ==============
// TOKEN ENCODING
// ==============

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

  // Encode resource roles (ONLY THOSE NOT GRANTED BY A GLOBAL ROLE (for
  // encoding efficiency purposes))
  const resourceRoles = decodedToken.resourceRoles
    .filter(
      resourceRole =>
        !decodedToken.globalRoles.some(globalRole =>
          drillRoles({role: globalRole}).some(rr => rr === resourceRole.role)
        )
    )
    .map(({resourceId, role}) => encodeClaim({resourceId, claim: role}));

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
