/**
 * Long Lived Token Management Module
 *
 * This module provides functionality for managing long-lived API tokens in the Auth
 * CouchDB. It includes methods for creating, updating, validating, and retrieving
 * long-lived tokens, as well as utility functions for token management.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  ExistingPeopleDBDocument,
  GetLongLivedTokenIndex,
  LongLivedTokenExistingDocument,
  LongLivedTokenFields,
  safeWriteDocument,
} from '@faims3/data-model';
import {v4 as uuidv4} from 'uuid';
import {getAuthDB} from '.';
import {MAXIMUM_LONG_LIVED_DURATION_DAYS} from '../buildconfig';
import {
  InternalSystemError,
  ItemNotFoundException,
  InvalidRequestException,
} from '../exceptions';
import {generateVerificationCode, hashChallengeCode} from '../utils';
import {getCouchUserFromEmailOrUserId} from './users';

// Convert days to milliseconds
const DAY_IN_MS = 24 * 60 * 60 * 1000;
// We want this pretty long as these tokens are used for long-term access - need
// higher security to avoid brute forcing
const LONG_LIVED_TOKEN_LENGTH = 64;

/**
 * Validates if the provided expiry date is allowed based on configuration
 * @param expiryTimestampMs The expiry timestamp in milliseconds, or undefined for infinite
 * @returns boolean indicating if the expiry is valid
 */
export function isValidExpiry(expiryTimestampMs: number | undefined): boolean {
  // If no expiry specified (infinite), check if unlimited duration is allowed
  if (expiryTimestampMs === undefined) {
    return MAXIMUM_LONG_LIVED_DURATION_DAYS === undefined;
  }

  // If unlimited duration is allowed, any future date is valid
  if (MAXIMUM_LONG_LIVED_DURATION_DAYS === undefined) {
    return expiryTimestampMs > Date.now();
  }

  // Check if the expiry date is within the maximum allowed duration
  const maxAllowedTimestamp =
    Date.now() + MAXIMUM_LONG_LIVED_DURATION_DAYS * DAY_IN_MS;
  return (
    expiryTimestampMs > Date.now() && expiryTimestampMs <= maxAllowedTimestamp
  );
}

/**
 * Gets the maximum allowed expiry timestamp based on configuration
 * @returns The maximum allowed expiry timestamp, or undefined if unlimited
 */
export function getMaxAllowedExpiryTimestamp(): number | undefined {
  if (MAXIMUM_LONG_LIVED_DURATION_DAYS === undefined) {
    return undefined;
  }
  return Date.now() + MAXIMUM_LONG_LIVED_DURATION_DAYS * DAY_IN_MS;
}

/**
 * Creates a new long-lived token for a given user.
 * @param params Configuration for the new token
 * @returns A Promise that resolves to an object containing the token record and raw token
 */
export const createNewLongLivedToken = async ({
  userId,
  title,
  description,
  expiryTimestampMs = undefined,
}: {
  userId: string;
  title: string;
  description: string;
  expiryTimestampMs?: number | undefined;
}): Promise<{record: LongLivedTokenExistingDocument; token: string}> => {
  // Validate expiry
  if (!isValidExpiry(expiryTimestampMs)) {
    const maxAllowed = getMaxAllowedExpiryTimestamp();
    const errorMessage = maxAllowed
      ? `Invalid expiry date. Must be in the future and no later than ${new Date(maxAllowed).toISOString()}`
      : 'Invalid expiry date. Infinite expiry is not allowed.';
    throw new InvalidRequestException(errorMessage);
  }

  const authDB = getAuthDB();
  const token = generateVerificationCode(LONG_LIVED_TOKEN_LENGTH);
  const tokenHash = hashChallengeCode(token);
  const dbId = AUTH_RECORD_ID_PREFIXES.longlived + uuidv4();
  const currentTimestamp = Date.now();

  const newLongLivedToken: LongLivedTokenFields = {
    documentType: 'longlived',
    userId,
    tokenHash,
    title,
    description,
    enabled: true,
    createdTimestampMs: currentTimestamp,
    updatedTimestampMs: currentTimestamp,
    expiryTimestampMs: expiryTimestampMs,
    lastUsedTimestampMs: undefined,
  };

  const response = await authDB.put({_id: dbId, ...newLongLivedToken});
  const record = await authDB.get<LongLivedTokenExistingDocument>(response.id);

  return {record, token};
};

/**
 * Updates the metadata of an existing long-lived token.
 * @param tokenId The ID of the token to update
 * @param updates The fields to update
 * @returns A Promise that resolves to the updated token record
 */
export const updateLongLivedToken = async (
  tokenId: string,
  updates: {
    title?: string;
    description?: string;
  }
): Promise<LongLivedTokenExistingDocument> => {
  const authDB = getAuthDB();

  try {
    const tokenDoc = await authDB.get<LongLivedTokenExistingDocument>(tokenId);

    if (tokenDoc.documentType !== 'longlived') {
      throw new InvalidRequestException('Document is not a long-lived token');
    }

    // Update only the provided fields
    if (updates.title !== undefined) {
      tokenDoc.title = updates.title;
    }
    if (updates.description !== undefined) {
      tokenDoc.description = updates.description;
    }

    // Always update the timestamp
    tokenDoc.updatedTimestampMs = Date.now();

    await authDB.put(tokenDoc);
    return tokenDoc;
  } catch (error) {
    if ((error as any).status === 404) {
      throw new ItemNotFoundException(
        `Long-lived token with ID ${tokenId} not found.`
      );
    }
    throw error;
  }
};

/**
 * Revokes a long-lived token by setting enabled to false.
 * @param tokenId The ID of the token to revoke
 * @returns A Promise that resolves to the revoked token record
 */
export const revokeLongLivedToken = async (
  tokenId: string
): Promise<LongLivedTokenExistingDocument> => {
  const authDB = getAuthDB();

  try {
    const tokenDoc = await authDB.get<LongLivedTokenExistingDocument>(tokenId);

    if (tokenDoc.documentType !== 'longlived') {
      throw new InvalidRequestException('Document is not a long-lived token');
    }

    tokenDoc.enabled = false;
    tokenDoc.updatedTimestampMs = Date.now();

    await authDB.put(tokenDoc);
    return tokenDoc;
  } catch (error) {
    if ((error as any).status === 404) {
      throw new ItemNotFoundException(
        `Long-lived token with ID ${tokenId} not found.`
      );
    }
    throw error;
  }
};

/**
 * Validates a long-lived token and optionally updates last used timestamp.
 * @param tokenHash The hashed token to validate
 * @param updateLastUsed Whether to update the last used timestamp
 * @returns A Promise that resolves to validation result and user info
 */
export const validateLongLivedToken = async (
  tokenHash: string,
  updateLastUsed = true
): Promise<{
  valid: boolean;
  user?: ExistingPeopleDBDocument;
  token?: LongLivedTokenExistingDocument;
  validationError?: string;
}> => {
  try {
    const tokenDoc = await getTokenByTokenHash(tokenHash);

    if (!tokenDoc) {
      return {
        valid: false,
        validationError: 'Invalid token.',
      };
    }

    if (!tokenDoc.enabled) {
      return {
        valid: false,
        validationError: 'Token has been revoked.',
      };
    }

    if (tokenDoc.expiryTimestampMs && tokenDoc.expiryTimestampMs < Date.now()) {
      return {
        valid: false,
        validationError: 'Token has expired.',
      };
    }

    const user = await getCouchUserFromEmailOrUserId(tokenDoc.userId);
    if (!user) {
      return {
        valid: false,
        validationError: 'Could not find associated user.',
      };
    }

    // Update last used timestamp if requested
    if (updateLastUsed) {
      tokenDoc.lastUsedTimestampMs = Date.now();
      try {
        await safeWriteDocument({
          db: getAuthDB(),
          data: tokenDoc,
          writeOnClash: true,
        });
      } catch (e) {
        console.error(
          'Error updating last used timestamp for long-lived token:',
          e
        );
        throw e;
      }
    }

    return {valid: true, user, token: tokenDoc};
  } catch (error) {
    console.error(
      'Unhandled error validating long-lived token. Token hash: ',
      tokenHash,
      ' Error: ',
      error,
      console.trace()
    );
    return {valid: false, validationError: 'Internal server error'};
  }
};

/**
 * Retrieves all long-lived tokens for a given user.
 * @param userId The ID of the user whose tokens are being retrieved
 * @returns A Promise that resolves to an array of token records
 */
export const getTokensByUserId = async (
  userId: string
): Promise<LongLivedTokenExistingDocument[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<LongLivedTokenExistingDocument>(
    'viewsDocument/longLivedTokensByUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};

/**
 * Retrieves a long-lived token document by its token hash.
 * @param tokenHash The hashed token to search for
 * @returns A Promise that resolves to the token record or undefined
 */
export const getTokenByTokenHash = async (
  tokenHash: string
): Promise<LongLivedTokenExistingDocument | undefined> => {
  const authDB = getAuthDB();

  const result = await authDB.query<LongLivedTokenExistingDocument>(
    'viewsDocument/longLivedTokensByTokenHash',
    {
      key: tokenHash,
      include_docs: true,
    }
  );

  const filtered = result.rows.filter(r => !!r.doc).map(row => row.doc!);

  if (filtered.length === 0) {
    return undefined;
  }

  if (filtered.length > 1) {
    throw new InternalSystemError(
      'Duplicate items sharing a token hash. Cannot validate this long-lived token.'
    );
  }

  return filtered[0];
};

/**
 * Retrieves a long-lived token document by its document ID.
 * @param tokenId The document ID of the token
 * @returns A Promise that resolves to the token record
 */
export const getTokenById = async (
  tokenId: string
): Promise<LongLivedTokenExistingDocument> => {
  const authDB = getAuthDB();
  return await authDB.get<LongLivedTokenExistingDocument>(tokenId);
};

/**
 * Retrieves all long-lived tokens in the database.
 * @returns A Promise that resolves to an array of all token records
 */
export const getAllTokens = async (): Promise<
  LongLivedTokenExistingDocument[]
> => {
  const authDB = getAuthDB();

  const result = await authDB.query<LongLivedTokenExistingDocument>(
    'viewsDocument/longLivedTokens',
    {
      include_docs: true,
    }
  );

  return result.rows.map(row => row.doc as LongLivedTokenExistingDocument);
};

/**
 * Deletes a long-lived token based on the specified index and identifier.
 * @param index The index to use for finding the token ('id' or 'tokenHash')
 * @param identifier The value to search for using the specified index
 * @returns A Promise that resolves when the token is successfully deleted
 */
export const deleteLongLivedToken = async (
  index: GetLongLivedTokenIndex,
  identifier: string
): Promise<void> => {
  const authDB = getAuthDB();
  let tokenDoc: LongLivedTokenExistingDocument | undefined = undefined;

  if (index === 'id') {
    try {
      tokenDoc = await getTokenById(identifier);
    } catch (error) {
      if ((error as any).status === 404) {
        throw new Error(`Long-lived token with ID ${identifier} not found.`);
      }
      throw error;
    }
  } else if (index === 'tokenHash') {
    tokenDoc = await getTokenByTokenHash(identifier);
    if (!tokenDoc) {
      throw new Error(`Long-lived token with hash ${identifier} not found.`);
    }
  } else {
    throw new Error(`Invalid index type: ${index}`);
  }

  try {
    if (tokenDoc) await authDB.remove(tokenDoc);
  } catch (error) {
    throw new Error(
      `Failed to delete long-lived token: ${(error as Error).message}`
    );
  }
};
