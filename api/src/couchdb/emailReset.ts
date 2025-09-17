/**
 * Email Code Management Module
 *
 * This module provides functionality for managing email verification codes in the Auth
 * CouchDB. It includes methods for creating, validating, and retrieving email codes,
 * as well as utility functions for code expiration.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  EmailCodeExistingDocument,
  EmailCodeFields,
  ExistingPeopleDBDocument,
  GetEmailCodeIndex,
} from '@faims3/data-model';
import {v4 as uuidv4} from 'uuid';
import {getAuthDB} from '.';
import {buildQueryString} from '../auth/helpers';
import {CONDUCTOR_PUBLIC_URL, EMAIL_CODE_EXPIRY_MINUTES} from '../buildconfig';
import {
  InternalSystemError,
  ItemNotFoundException,
  TooManyRequestsException,
} from '../exceptions';
import {generateVerificationCode, hashChallengeCode} from '../utils';
import {getCouchUserFromEmailOrUserId} from './users';

// Expiry time in milliseconds
const CODE_EXPIRY_MS = EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000;

/**
 * Configuration constants for email code rate limiting
 */

// Maximum number of email codes a user can request within the rate limit window
export const MAX_EMAIL_CODE_ATTEMPTS = 5;
// Rate limit window in milliseconds (30 minutes)
export const EMAIL_CODE_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
// Cooldown period in milliseconds (2 hours) after reaching max attempts
export const EMAIL_CODE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/**
 * Takes a reset code and embeds into URL
 * @param code The unhashed code to embed into the URL
 * @returns The URL to present to the user
 */
export function buildCodeIntoUrl({
  code,
  redirect,
}: {
  code: string;
  redirect: string;
}): string {
  return `${CONDUCTOR_PUBLIC_URL}/reset-password${buildQueryString({values: {code, redirect}})}`;
}

/**
 * Checks if a user can create a new email code based on previous attempts.
 *
 * @param userId - The ID of the user requesting the code
 * @param email - The email address for the code (if applicable)
 * @param purpose - The purpose of the code (e.g., 'password-reset')
 * @param maxAttempts - Maximum number of allowed attempts in the rate limit window
 * @param rateLimitWindowMs - Time window for rate limiting in milliseconds
 * @param cooldownMs - Cooldown period after max attempts in milliseconds
 *
 * @returns A Promise that resolves to an object indicating if the user can create a code
 */
export const checkCanCreateEmailCode = async ({
  userId,
  maxAttempts = MAX_EMAIL_CODE_ATTEMPTS,
  rateLimitWindowMs = EMAIL_CODE_RATE_LIMIT_WINDOW_MS,
  cooldownMs = EMAIL_CODE_COOLDOWN_MS,
}: {
  userId: string;
  maxAttempts?: number;
  rateLimitWindowMs?: number;
  cooldownMs?: number;
}): Promise<{
  canCreate: boolean;
  reason?: string;
  nextAttemptAllowedAt?: number;
}> => {
  // Get all email codes for this user within the rate limit window
  const timeThreshold = Date.now() - rateLimitWindowMs;

  // Get the user's email codes
  const codes = await getCodesByUserId(userId);

  // Filter codes by purpose and/or email if provided
  const recentCodes = codes.filter(code => {
    // Basic time filter
    return (code.createdTimestampMs || 0) > timeThreshold;
  });

  // Count the number of attempts
  const attemptCount = recentCodes.length;

  // If user has not exceeded max attempts, they can create
  if (attemptCount < maxAttempts) {
    return {canCreate: true};
  }

  // Find the most recent code to calculate cooldown
  if (recentCodes.length === 0) {
    return {canCreate: true}; // Shouldn't happen but safety check
  }

  const mostRecentCode = recentCodes.reduce((latest, current) => {
    const latestCreated = latest.createdTimestampMs || 0;
    const currentCreated = current.createdTimestampMs || 0;
    return currentCreated > latestCreated ? current : latest;
  }, recentCodes[0]);

  // Calculate when the cooldown period ends
  const mostRecentTimestamp = mostRecentCode.createdTimestampMs || 0;
  const cooldownEndsAt = mostRecentTimestamp + cooldownMs;

  // If cooldown period has passed, they can create
  if (Date.now() > cooldownEndsAt) {
    return {canCreate: true};
  }

  // User must wait until cooldown ends
  return {
    canCreate: false,
    reason: 'Too many reset requests. Please try again later.',
    nextAttemptAllowedAt: cooldownEndsAt,
  };
};

/**
 * Generates an expiry timestamp for an email verification code.
 *
 * This function calculates the expiry timestamp based on the current time
 * and a predefined expiry duration.
 *
 * @param expiryMs The duration in milliseconds until the code expires
 * @returns {number} The expiry timestamp in milliseconds since the Unix epoch.
 */
function generateExpiryTimestamp(expiryMs: number): number {
  return Date.now() + expiryMs;
}

/**
 * Creates a new email verification code for a given user.
 * @param userId The ID of the user for whom the code is being created.
 * @param expiryMs The duration in milliseconds until the code expires
 * @returns A Promise that resolves to an object containing the AuthRecord and the raw verification code
 * @throws Error if rate limiting prevents code creation
 */
export const createNewEmailCode = async ({
  userId,
  expiryMs = CODE_EXPIRY_MS,
}: {
  userId: string;
  expiryMs?: number;
}): Promise<{record: EmailCodeExistingDocument; code: string}> => {
  // Check rate limiting constraints
  const rateCheckResult = await checkCanCreateEmailCode({
    userId,
  });

  if (!rateCheckResult.canCreate) {
    throw new TooManyRequestsException(
      rateCheckResult.reason || 'Rate limit exceeded for email code creation.'
    );
  }

  const authDB = getAuthDB();
  const code = generateVerificationCode();
  const hash = hashChallengeCode(code);
  const dbId = AUTH_RECORD_ID_PREFIXES.emailcode + uuidv4();
  const expiryTimestampMs = generateExpiryTimestamp(expiryMs);
  const currentTimestamp = Date.now();

  const newEmailCode: EmailCodeFields = {
    documentType: 'emailcode',
    userId,
    code: hash,
    used: false,
    expiryTimestampMs,
    createdTimestampMs: currentTimestamp,
  };

  const response = await authDB.put({_id: dbId, ...newEmailCode});
  const record = await authDB.get<EmailCodeExistingDocument>(response.id);

  // Return both the database record and the raw code
  return {record, code};
};

/**
 * Validates an email verification code for a given user.
 * @param code The verification code to validate (not hashed)
 * @param userId Optional user ID to validate against.
 * @returns A Promise that resolves to an object indicating validity and any validation errors.
 */
export const validateEmailCode = async (
  code: string,
  userId?: string
): Promise<{
  valid: boolean;
  user?: ExistingPeopleDBDocument;
  validationError?: string;
}> => {
  try {
    // Hash the code
    const hashedCode = hashChallengeCode(code);

    // Try to find the code (hashed)
    const codeDoc = await getCodeByCode(hashedCode);

    if (!codeDoc) {
      return {
        valid: false,
        validationError: 'Invalid reset code.',
      };
    }

    if (userId && codeDoc.userId !== userId) {
      return {
        valid: false,
        validationError: 'Reset code does not belong to the specified user.',
      };
    }

    if (codeDoc.used) {
      return {
        valid: false,
        validationError: 'Reset code has already been used.',
      };
    }

    if (codeDoc.expiryTimestampMs < Date.now()) {
      return {valid: false, validationError: 'Code has expired.'};
    }

    const user = await getCouchUserFromEmailOrUserId(codeDoc.userId);
    if (!user) {
      return {
        valid: false,
        validationError: 'Could not find associated user.',
      };
    }

    return {valid: true, user};
  } catch (error) {
    console.error(
      'Unhandled error validating email code. Code: ',
      code,
      ' Error: ',
      error,
      console.trace()
    );
    return {valid: false, validationError: 'Internal server error'};
  }
};

/**
 * Marks an email code as used.
 * @param code The verification code to mark as used (not hashed)
 * @returns A Promise that resolves to the updated AuthRecord.
 */
export const markCodeAsUsed = async (
  code: string
): Promise<EmailCodeExistingDocument> => {
  const hashedCode = hashChallengeCode(code);
  const codeDoc = await getCodeByCode(hashedCode);

  if (!codeDoc) {
    throw new ItemNotFoundException('Could not find the specified code.');
  }

  codeDoc.used = true;

  const authDB = getAuthDB();
  await authDB.put(codeDoc);
  return codeDoc;
};

/**
 * Retrieves all email codes for a given user.
 * @param userId The ID of the user whose codes are being retrieved.
 * @returns A Promise that resolves to an array of AuthRecords.
 */
export const getCodesByUserId = async (
  userId: string
): Promise<EmailCodeExistingDocument[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<EmailCodeExistingDocument>(
    'viewsDocument/emailCodesByUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};

/**
 * Retrieves an email code document by its code value.
 * @param code The verification code to search for.
 * @returns A Promise that resolves to the AuthRecord associated with the code.
 */
export const getCodeByCode = async (
  code: string
): Promise<EmailCodeExistingDocument | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<EmailCodeExistingDocument>(
    'viewsDocument/emailCodesByCode',
    {
      key: code,
      include_docs: true,
    }
  );

  const filtered = result.rows.filter(r => !!r.doc).map(row => row.doc!);

  if (filtered.length === 0) {
    return null;
  }

  if (filtered.length > 1) {
    throw new InternalSystemError(
      'Duplicate items sharing a code. Cannot validate this email code.'
    );
  }

  return filtered[0];
};

/**
 * Retrieves all email codes in the database.
 * @returns A Promise that resolves to an array of all AuthRecords.
 */
export const getAllCodes = async (): Promise<EmailCodeExistingDocument[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<EmailCodeExistingDocument>(
    'viewsDocument/emailCodes',
    {
      include_docs: true,
    }
  );

  return result.rows.map(row => row.doc as EmailCodeExistingDocument);
};

/**
 * Deletes an email code based on the specified index and identifier.
 *
 * @param index The index to use for finding the code ('id' or 'code').
 * @param identifier The value to search for using the specified index.
 * @returns A Promise that resolves when the code is successfully deleted.
 * @throws Error if the code is not found or if there's an issue with deletion.
 */
export const deleteEmailCode = async (
  index: GetEmailCodeIndex,
  identifier: string
): Promise<void> => {
  const authDB = getAuthDB();
  let codeDoc: EmailCodeExistingDocument | null = null;

  if (index === 'id') {
    try {
      codeDoc = await authDB.get(identifier);
    } catch (error) {
      if ((error as any).status === 404) {
        throw new Error(`Email code with ID ${identifier} not found.`);
      }
      throw error;
    }
  } else if (index === 'code') {
    codeDoc = await getCodeByCode(identifier);
    if (!codeDoc) {
      throw new Error(`Email code with code ${identifier} not found.`);
    }
  } else {
    throw new Error(`Invalid index type: ${index}`);
  }

  try {
    if (codeDoc) await authDB.remove(codeDoc);
  } catch (error) {
    throw new Error(`Failed to delete email code: ${(error as Error).message}`);
  }
};
