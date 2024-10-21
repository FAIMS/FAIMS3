/**
 * Refresh Token Management Module
 *
 * This module provides functionality for managing refresh tokens in the Auth
 * CouchDB. It includes methods for creating, validating, and retrieving refresh
 * tokens, as well as utility functions for token expiration.
 */

import {
  AuthRecord,
  AuthRecordIdPrefixMap,
  GetRefreshTokenIndex,
  RefreshRecordFields,
} from '@faims3/data-model';
import {getAuthDB} from '.';
import {v4 as uuidv4} from 'uuid';
import {InternalSystemError, ItemNotFoundException} from '../exceptions';
import {getUserFromEmailOrUsername} from './users';

// Expiry time in hours
const TOKEN_EXPIRY_HOURS = 24; // 24 hours
const TOKEN_EXPIRY_MS = TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

/**
 * Generates an expiry timestamp for a refresh token.
 *
 * This function calculates the expiry timestamp based on the current time
 * and a predefined expiry duration. The expiry duration is set using the
 * TOKEN_EXPIRY_HOURS constant, which represents the number of hours from
 * the current time until the token expires.
 *
 * @returns {number} The expiry timestamp in milliseconds since the Unix epoch.
 */
function generateExpiryTimestamp(expiryMs: number): number {
  const currentTimestamp = Date.now();
  return currentTimestamp + expiryMs;
}

/**
 * Creates a new refresh token for a given user.
 * @param userId The ID of the user for whom the token is being created.
 * @returns A Promise that resolves to the newly created AuthRecord.
 */
export const createNewRefreshToken = async (
  userId: string,
  expiryMs: number = TOKEN_EXPIRY_MS
): Promise<AuthRecord> => {
  const authDB = getAuthDB();

  // Generate a new UUID for the token
  const token = uuidv4();
  const dbId = AuthRecordIdPrefixMap.get('refresh') + uuidv4();

  // Set expiry to configured duration
  const expiryTimestampMs = generateExpiryTimestamp(expiryMs);

  const newRefreshToken: RefreshRecordFields = {
    documentType: 'refresh',
    userId,
    token,
    expiryTimestampMs,
    enabled: true,
  };

  // Create a new document in the database
  const response = await authDB.put({_id: dbId, ...newRefreshToken});

  // Fetch the created document to return the full AuthRecord
  return await authDB.get(response.id);
};

/**
 * Validates a refresh token for a given user. Also fetches the user from the DB.
 * @param refreshToken The refresh token to validate.
 * @param userId The ID of the user associated with the token.
 * @returns A Promise that resolves to an object indicating validity and any validation errors.
 */
export const validateRefreshToken = async (
  refreshToken: string,
  userId?: string
): Promise<{valid: boolean; user?: Express.User; validationError?: string}> => {
  try {
    const tokenDoc = await getTokenByToken(refreshToken);

    if (!tokenDoc) {
      return {
        valid: false,
        validationError: 'Document was not present for specified token.',
      };
    }

    // Check if the token belongs to the correct user (If a user ID is supplied for validation)
    if (userId && tokenDoc.userId !== userId) {
      return {
        valid: false,
        validationError: 'Token does not belong to the user specified.',
      };
    }

    // Check if the token is enabled
    if (!tokenDoc.enabled) {
      return {valid: false, validationError: 'Token is not enabled.'};
    }

    // Check if the token has expired
    if (tokenDoc.expiryTimestampMs < Date.now()) {
      return {valid: false, validationError: 'Token has expired'};
    }

    // Get the user by the user ID
    const user =
      (await getUserFromEmailOrUsername(tokenDoc.userId)) ?? undefined;

    if (!user) {
      return {
        valid: false,
        validationError:
          'While token appears valid, could not find associated user.',
      };
    }

    return {valid: true, user};
  } catch (error) {
    console.error(
      'Unhandled error validating refresh token. Token: ',
      refreshToken,
      ' Error: ',
      error,
      console.trace()
    );
    return {valid: false, validationError: 'Internal server error'};
  }
};

/**
 * Retrieves all refresh tokens for a given user.
 * @param userId The ID of the user whose tokens are being retrieved.
 * @returns A Promise that resolves to an array of AuthRecords.
 */
export const getTokensByUserId = async (
  userId: string
): Promise<AuthRecord[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>(
    'viewsDocument/refreshTokensByUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};

/**
 * Invalidates an existing token by setting enabled = false
 * @param token The token value to invalidate
 * @returns A Promise that resolves to the AuthRecord associated with the invalidated token.
 */
export const invalidateToken = async (
  token: string
): Promise<AuthRecord | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>(
    'viewsDocument/refreshTokensByToken',
    {
      key: token,
      include_docs: true,
    }
  );

  const filtered = result.rows.filter(r => !!r.doc).map(row => row.doc!);

  if (filtered.length === 0) {
    throw new ItemNotFoundException('Could not find the specified token.');
  }

  if (filtered.length > 1) {
    throw new InternalSystemError(
      'Duplicate items sharing a token. Cannot invalidate this refresh token.'
    );
  }

  const existingTokenDoc = filtered[0];

  // Update the valid property
  existingTokenDoc.enabled = false;

  // put back with enabled as false
  try {
    await authDB.put(existingTokenDoc);
  } catch (e) {
    throw new InternalSystemError(
      'Failed to update existing auth DB refresh token record during invalidation. Error: ' +
        e
    );
  }

  return existingTokenDoc;
};

/**
 * Retrieves a refresh token document by its token value.
 * @param token The token value to search for.
 * @returns A Promise that resolves to the AuthRecord associated with the token.
 */
export const getTokenByToken = async (
  token: string
): Promise<AuthRecord | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>(
    'viewsDocument/refreshTokensByToken',
    {
      key: token,
      include_docs: true,
    }
  );

  const filtered = result.rows.filter(r => !!r.doc).map(row => row.doc!);

  if (filtered.length === 0) {
    return null;
  }

  if (filtered.length > 1) {
    throw new InternalSystemError(
      'Duplicate items sharing a token. Cannot validate this refresh token.'
    );
  }

  return filtered[0];
};

/**
 * Retrieves a refresh token document by its document ID.
 * @param tokenId The document ID of the token.
 * @returns A Promise that resolves to the AuthRecord associated with the token ID.
 */
export const getTokenByTokenId = async (
  tokenId: string
): Promise<AuthRecord> => {
  const authDB = getAuthDB();

  // Directly fetch the document by its ID
  return await authDB.get(tokenId);
};

/**
 * Retrieves all refresh tokens in the database.
 * @returns A Promise that resolves to an array of all AuthRecords.
 */
export const getAllTokens = async (): Promise<AuthRecord[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>('viewsDocument/refreshTokens', {
    include_docs: true,
  });

  return result.rows.map(row => row.doc as AuthRecord);
};

/**
 * Deletes a refresh token based on the specified index and identifier.
 *
 * @param index The index to use for finding the token ('id' or 'token').
 * @param identifier The value to search for using the specified index.
 * @returns A Promise that resolves when the token is successfully deleted.
 * @throws Error if the token is not found or if there's an issue with deletion.
 */
export const deleteRefreshToken = async (
  index: GetRefreshTokenIndex,
  identifier: string
): Promise<void> => {
  const authDB = getAuthDB();
  let tokenDoc: AuthRecord | null = null;

  // Find the token document based on the specified index
  if (index === 'id') {
    try {
      tokenDoc = await getTokenByTokenId(identifier);
    } catch (error) {
      if ((error as any).status === 404) {
        throw new Error(`Refresh token with ID ${identifier} not found.`);
      }
      throw error;
    }
  } else if (index === 'token') {
    tokenDoc = await getTokenByToken(identifier);
    if (!tokenDoc) {
      throw new Error(`Refresh token with token ${identifier} not found.`);
    }
  } else {
    throw new Error(`Invalid index type: ${index}`);
  }

  // If we've reached this point, we have a valid tokenDoc
  try {
    await authDB.remove(tokenDoc._id, tokenDoc._rev);
  } catch (error) {
    throw new Error(
      `Failed to delete refresh token: ${(error as Error).message}`
    );
  }
};
