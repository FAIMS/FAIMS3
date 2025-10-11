/**
 * Refresh Token Management Module
 *
 * This module provides functionality for managing refresh tokens in the Auth
 * CouchDB. It includes methods for creating, validating, and retrieving refresh
 * tokens, as well as utility functions for token expiration.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  ExistingPeopleDBDocument,
  GetRefreshTokenIndex,
  RefreshRecordExistingDocument,
  RefreshRecordFields,
} from '@faims3/data-model';
import {v4 as uuidv4} from 'uuid';
import {getAuthDB} from '.';
import {REFRESH_TOKEN_EXPIRY_MINUTES} from '../buildconfig';
import {InternalSystemError, ItemNotFoundException} from '../exceptions';
import {generateVerificationCode, hashChallengeCode} from '../utils';
import {getCouchUserFromEmailOrUserId} from './users';

// Expiry time in hours
const TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_MINUTES * 60 * 1000;
// 5 minutes
const EXCHANGE_EXPIRY_MS = 60 * 1000 * 5;

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
export const createNewRefreshToken = async ({
  userId,
  refreshExpiryMs = TOKEN_EXPIRY_MS,
  exchangeExpiryMs = EXCHANGE_EXPIRY_MS,
}: {
  userId: string;
  refreshExpiryMs?: number;
  exchangeExpiryMs?: number;
}): Promise<{
  refresh: RefreshRecordExistingDocument;
  exchangeToken: string;
}> => {
  const authDB = getAuthDB();

  // Generate a new UUID for the token
  const token = uuidv4();
  const dbId = AUTH_RECORD_ID_PREFIXES.refresh + uuidv4();

  // Set expiry to configured duration
  const refreshExpiry = generateExpiryTimestamp(refreshExpiryMs);
  const exchangeExpiry = generateExpiryTimestamp(exchangeExpiryMs);

  // Create the exchange token
  const code = generateVerificationCode();
  const hash = hashChallengeCode(code);
  const newRefreshToken: RefreshRecordFields = {
    documentType: 'refresh',
    userId,
    expiryTimestampMs: refreshExpiry,
    token,
    enabled: true,
    // this is the HASH of the exchange token (to be looked up later)
    exchangeTokenHash: hash,
    exchangeTokenUsed: false,
    exchangeTokenExpiryTimestampMs: exchangeExpiry,
  };

  // Create a new document in the database
  const response = await authDB.put({_id: dbId, ...newRefreshToken});

  // Fetch the created document to return the full AuthRecord
  return {
    refresh: await authDB.get<RefreshRecordExistingDocument>(response.id),
    exchangeToken: code,
  };
};

/**
 * Takes the raw exchange token, hashes it, searches for a refresh token, then
 * returns it. Invalidates the exchange in the DB.
 * @param exchangeToken - raw exchange token (provided to user for one time use)
 * @param userId - the user ID to check for match, if available
 */
export const consumeExchangeTokenForRefreshToken = async ({
  exchangeToken,
  userId,
}: {
  exchangeToken: string;
  userId?: string;
}): Promise<{
  valid: boolean;
  validationError?: string;
  refreshDocument?: RefreshRecordExistingDocument;
  user?: ExistingPeopleDBDocument;
}> => {
  const exchangeTokenHash = hashChallengeCode(exchangeToken);
  try {
    const tokenDocs = await getTokensByExchangeTokenHash({
      exchangeTokenHash,
    });

    if (tokenDocs.length === 0) {
      return {
        valid: false,
        validationError:
          'The exchange token does not refer to a valid refresh token',
      };
    }

    if (tokenDocs.length > 1) {
      return {
        valid: false,
        validationError:
          'The exchange token refers to multiple refresh tokens. Unsure how to proceed.',
      };
    }

    const tokenDoc = tokenDocs[0];

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

    // Check if the exchangeToken has expired (this is more likely as it has a
    // short duration)
    if (tokenDoc.exchangeTokenExpiryTimestampMs < Date.now()) {
      return {valid: false, validationError: 'Exchange token has expired'};
    }

    // Check if the refresh token has expired
    if (tokenDoc.expiryTimestampMs < Date.now()) {
      return {valid: false, validationError: 'Token has expired'};
    }

    // Get the user by the user ID
    const user =
      (await getCouchUserFromEmailOrUserId(tokenDoc.userId)) ?? undefined;

    if (!user) {
      return {
        valid: false,
        validationError:
          'While token appears valid, could not find associated user.',
      };
    }

    // consume the exchange token
    tokenDoc.exchangeTokenUsed = true;
    await getAuthDB().put(tokenDoc);

    return {valid: true, user, refreshDocument: tokenDoc};
  } catch (error) {
    console.error(
      'Unhandled error validating refresh token. Token hash: ',
      exchangeTokenHash,
      ' Error: ',
      error,
      console.trace()
    );
    return {valid: false, validationError: 'Internal server error'};
  }
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
): Promise<{
  valid: boolean;
  user?: ExistingPeopleDBDocument;
  validationError?: string;
}> => {
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
      (await getCouchUserFromEmailOrUserId(tokenDoc.userId)) ?? undefined;

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
): Promise<RefreshRecordExistingDocument[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<RefreshRecordExistingDocument>(
    'viewsDocument/refreshTokensByUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  return result.rows
    .filter(r => !!r.doc)
    .map(row => row.doc! as RefreshRecordExistingDocument);
};

/**
 * Retrieves all refresh tokens for a given user.
 * @param userId The ID of the user whose tokens are being retrieved.
 * @returns A Promise that resolves to an array of AuthRecords.
 */
export const getTokensByExchangeTokenHash = async ({
  exchangeTokenHash,
}: {
  exchangeTokenHash: string;
}): Promise<RefreshRecordExistingDocument[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<RefreshRecordExistingDocument>(
    'viewsDocument/refreshTokensByExchangeTokenHash',
    {
      key: exchangeTokenHash,
      include_docs: true,
    }
  );

  return result.rows
    .filter(r => !!r.doc)
    .map(row => row.doc! as RefreshRecordExistingDocument);
};

/**
 * Invalidates an existing token by setting enabled = false
 * @param token The token value to invalidate
 * @returns A Promise that resolves to the AuthRecord associated with the invalidated token.
 */
export const invalidateToken = async (
  token: string
): Promise<RefreshRecordExistingDocument | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<RefreshRecordExistingDocument>(
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
): Promise<RefreshRecordExistingDocument | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<RefreshRecordExistingDocument>(
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
 * @returns A Promise that resolves to the RefreshRecord associated with the token ID.
 */
export const getTokenByTokenId = async (
  tokenId: string
): Promise<RefreshRecordExistingDocument> => {
  const authDB = getAuthDB();

  // Directly fetch the document by its ID
  return await authDB.get<RefreshRecordExistingDocument>(tokenId);
};

/**
 * Retrieves all refresh tokens in the database.
 * @returns A Promise that resolves to an array of all RefreshRecord.
 */
export const getAllTokens = async (): Promise<
  RefreshRecordExistingDocument[]
> => {
  const authDB = getAuthDB();

  const result = await authDB.query<RefreshRecordExistingDocument>(
    'viewsDocument/refreshTokens',
    {
      include_docs: true,
    }
  );

  return result.rows.map(row => row.doc as RefreshRecordExistingDocument);
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
  let tokenDoc: RefreshRecordExistingDocument | null = null;

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
    await authDB.remove(tokenDoc);
  } catch (error) {
    throw new Error(
      `Failed to delete refresh token: ${(error as Error).message}`
    );
  }
};
