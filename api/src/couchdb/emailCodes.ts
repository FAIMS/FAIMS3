/**
 * Email Code Management Module
 *
 * This module provides functionality for managing email verification codes in the Auth
 * CouchDB. It includes methods for creating, validating, and retrieving email codes,
 * as well as utility functions for code expiration.
 */

import {
  AuthRecord,
  AuthRecordIdPrefixMap,
  GetEmailCodeIndex,
  EmailCodeFields,
  EmailCodeRecord,
  ExistingPeopleDBDocument,
} from '@faims3/data-model';
import {getAuthDB} from '.';
import {v4 as uuidv4} from 'uuid';
import {InternalSystemError, ItemNotFoundException} from '../exceptions';
import {getCouchUserFromEmailOrUsername} from './users';
import {EMAIL_CODE_EXPIRY_MINUTES, NEW_CONDUCTOR_URL} from '../buildconfig';
import crypto from 'crypto';

// Expiry time in milliseconds
const CODE_EXPIRY_MS = EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000;

// Configuration for verification codes
const VERIFICATION_CODE_LENGTH = 10;
const VERIFICATION_CODE_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Takes a reset code and embeds into URL
 * @param code The unhashed code to embed into the URL
 * @returns The URL to present to the user
 */
export function buildCodeIntoUrl(code: string): string {
  return `${NEW_CONDUCTOR_URL}/auth/resetPassword?code=${code}`;
}

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
 * Creates a cryptographic hash of a verification code.
 * Uses SHA-256 with a random salt for secure storage.
 *
 * @param code The verification code to hash
 * @returns An object containing the hash and salt
 */
export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generates a cryptographically secure random verification code.
 *
 * @param length The length of the code to generate (default: VERIFICATION_CODE_LENGTH)
 * @param charset The characters to use in the code (default: VERIFICATION_CODE_CHARSET)
 * @returns {string} A random verification code of the specified length
 */
function generateVerificationCode(
  length: number = VERIFICATION_CODE_LENGTH,
  charset: string = VERIFICATION_CODE_CHARSET
): string {
  if (length <= 0) {
    throw new Error('Code length must be greater than 0');
  }
  if (charset.length === 0) {
    throw new Error('Charset must not be empty');
  }

  // Calculate how many random bytes we need
  // We need enough bytes to have sufficient entropy for our charset
  const randomBytes = crypto.randomBytes(length * 2);
  let result = '';

  for (let i = 0; i < length; i++) {
    // Use two bytes for each character to ensure uniform distribution
    const randomValue = (randomBytes[i * 2] << 8) + randomBytes[i * 2 + 1];
    result += charset[randomValue % charset.length];
  }

  return result;
}

/**
 * Creates a new email verification code for a given user.
 * @param userId The ID of the user for whom the code is being created.
 * @param purpose The purpose of the email code (e.g., 'verification', 'password-reset')
 * @returns A Promise that resolves to an object containing the AuthRecord and the raw verification code
 */
export const createNewEmailCode = async (
  userId: string,
  expiryMs: number = CODE_EXPIRY_MS
): Promise<{record: EmailCodeRecord; code: string}> => {
  const authDB = getAuthDB();
  const code = generateVerificationCode();
  const hash = hashVerificationCode(code);
  const dbId = AuthRecordIdPrefixMap.get('emailcode') + uuidv4();
  const expiryTimestampMs = generateExpiryTimestamp(expiryMs);

  const newEmailCode: EmailCodeFields = {
    documentType: 'emailcode',
    userId,
    code: hash,
    used: false,
    expiryTimestampMs,
  };

  const response = await authDB.put({_id: dbId, ...newEmailCode});
  const record = await authDB.get<EmailCodeRecord>(response.id);

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
    const hashedCode = hashVerificationCode(code);

    // Try to find the code (hashed)
    const codeDoc: EmailCodeRecord | null = await getCodeByCode(hashedCode);

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

    const user = await getCouchUserFromEmailOrUsername(codeDoc.userId);
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
export const markCodeAsUsed = async (code: string): Promise<AuthRecord> => {
  const hashedCode = hashVerificationCode(code);
  const codeDoc: EmailCodeRecord | null = await getCodeByCode(hashedCode);

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
): Promise<AuthRecord[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>(
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
): Promise<EmailCodeRecord | null> => {
  const authDB = getAuthDB();

  const result = await authDB.query<EmailCodeRecord>(
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
export const getAllCodes = async (): Promise<AuthRecord[]> => {
  const authDB = getAuthDB();

  const result = await authDB.query<AuthRecord>('viewsDocument/emailCodes', {
    include_docs: true,
  });

  return result.rows.map(row => row.doc as AuthRecord);
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
  let codeDoc: AuthRecord | null = null;

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
    await authDB.remove(codeDoc._id, codeDoc._rev);
  } catch (error) {
    throw new Error(`Failed to delete email code: ${(error as Error).message}`);
  }
};
