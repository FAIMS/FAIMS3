/**
 * Verification Challenge Management Module
 *
 * This module provides functionality for managing email verification challenges in the Auth
 * CouchDB. It includes methods for creating, validating, and retrieving verification challenges,
 * as well as utility functions for challenge expiration and rate limiting.
 */

import {
  AUTH_RECORD_ID_PREFIXES,
  ExistingPeopleDBDocument,
  safeWriteDocument,
  VerificationChallengeExistingDocument,
  VerificationChallengeFields,
} from '@faims3/data-model';
import {getAuthDB} from '.';
import {config} from '../buildconfig';
import {InternalSystemError, ItemNotFoundException} from '../exceptions';
import {expiryMsFromNow, nowMs} from '../time';
import {generateVerificationCode, hashChallengeCode} from '../utils';
import {getCouchUserFromEmailOrUserId} from './users';

// Expiry time in milliseconds - 24 hours by default
const VERIFICATION_CHALLENGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Rate limiting constants
const MAX_VERIFICATION_ATTEMPTS = 5; // Maximum number of verification attempts
const VERIFICATION_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours window for rate limiting
const VERIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minute cooldown after max attempts

/**
 * Creates a new email verification challenge for a given user.
 *
 * @param userId - The ID of the user for whom the challenge is being created
 * @param email - The email address to be verified
 * @param expiryMs - Optional custom expiry time in milliseconds
 * @returns A Promise that resolves to an object containing the challenge
 * document and the raw verification code
 */
export const createVerificationChallenge = async ({
  userId,
  email,
  expiryMs = VERIFICATION_CHALLENGE_EXPIRY_MS,
}: {
  userId: string;
  email: string;
  expiryMs?: number;
}): Promise<{record: VerificationChallengeExistingDocument; code: string}> => {
  const authDB = getAuthDB();

  // Generate verification code and its hash
  const code = generateVerificationCode();
  const hash = hashChallengeCode(code);

  // Create a unique document ID with the verification prefix
  const dbId = AUTH_RECORD_ID_PREFIXES.verification + crypto.randomUUID();

  // Calculate expiry timestamp
  const expiryTimestampMs = expiryMsFromNow(expiryMs);

  // Create the verification challenge document
  const newVerificationChallenge: VerificationChallengeFields = {
    documentType: 'verification',
    userId,
    email,
    code: hash,
    used: false,
    expiryTimestampMs,
    createdTimestampMs: nowMs(),
  };

  // Save the document to the database
  const response = await authDB.put({_id: dbId, ...newVerificationChallenge});
  const record = await authDB.get<VerificationChallengeExistingDocument>(
    response.id
  );

  // Return both the database record and the raw code
  return {record, code};
};

/**
 * Checks if a user can create a new verification challenge based on previous
 * attempts.
 *
 * @param userId - The ID of the user requesting the verification
 * @param email - The email address to be verified
 * @param maxAttempts - Maximum number of allowed attempts in the rate limit
 * window
 * @param rateLimitWindowMs - Time window for rate limiting in milliseconds
 * @param cooldownMs - Cooldown period after max attempts in milliseconds
 *
 * @returns A Promise that resolves to an object indicating if the user can
 * create a challenge
 */
export const checkCanCreateVerificationChallenge = async ({
  userId,
  email,
  maxAttempts = MAX_VERIFICATION_ATTEMPTS,
  rateLimitWindowMs = VERIFICATION_RATE_LIMIT_WINDOW_MS,
  cooldownMs = VERIFICATION_COOLDOWN_MS,
}: {
  userId: string;
  email: string;
  maxAttempts?: number;
  rateLimitWindowMs?: number;
  cooldownMs?: number;
}): Promise<{
  canCreate: boolean;
  reason?: string;
  nextAttemptAllowedAt?: number;
}> => {
  // Independent of the HTTP IP limiter (RATE_LIMITER_ENABLED). Local/e2e
  // may set AUTH_ATTEMPT_LIMITER_ENABLED=false for repeated auth flows.
  if (!config.authAttemptLimiterEnabled) {
    return {canCreate: true};
  }

  // Get all verification challenges for this user and email within the rate
  // limit window
  const timeThreshold = Date.now() - rateLimitWindowMs;

  // Get the user's verification challenges
  const challenges = await getVerificationChallengesByUserId({userId});

  // Filter challenges for the specific email and within the time window
  const recentChallenges = challenges.filter(
    challenge =>
      challenge.email === email && challenge.createdTimestampMs > timeThreshold
  );

  // Count the number of attempts
  const attemptCount = recentChallenges.length;

  // If user has not exceeded max attempts, they can create
  if (attemptCount < maxAttempts) {
    return {canCreate: true};
  }

  // Find the most recent challenge to calculate cooldown
  const mostRecentChallenge = recentChallenges.reduce(
    (latest, current) =>
      current.createdTimestampMs > latest.createdTimestampMs ? current : latest,
    recentChallenges[0]
  );

  // Calculate when the cooldown period ends
  const cooldownEndsAt = mostRecentChallenge.createdTimestampMs + cooldownMs;

  // If cooldown period has passed, they can create
  if (Date.now() > cooldownEndsAt) {
    return {canCreate: true};
  }

  // User must wait until cooldown ends
  return {
    canCreate: false,
    reason: 'Too many verification attempts. Please try again later.',
    nextAttemptAllowedAt: cooldownEndsAt,
  };
};

/**
 * Validates a verification challenge.
 *
 * @param code - The verification code to validate (not hashed)
 * @param userId - Optional user ID to validate against
 * @param email - Optional email to validate against
 * @returns A Promise that resolves to an object indicating validity and any validation errors
 */
export const validateVerificationChallenge = async ({
  code,
  userId,
  email,
}: {
  code: string;
  userId?: string;
  email?: string;
}): Promise<{
  valid: boolean;
  user?: ExistingPeopleDBDocument;
  challenge?: VerificationChallengeExistingDocument;
  validationError?: string;
}> => {
  try {
    // Hash the code
    const hashedCode = hashChallengeCode(code);

    // Find the verification challenge
    const challenge = await getVerificationChallengeByCode({code: hashedCode});

    // Check if challenge exists
    if (!challenge) {
      return {
        valid: false,
        validationError: 'Invalid verification code.',
      };
    }

    // Check if challenge belongs to the specified user (if provided)
    if (userId && challenge.userId !== userId) {
      return {
        valid: false,
        validationError:
          'Verification code does not belong to the specified user.',
      };
    }

    // Check if challenge is for the specified email (if provided)
    if (email && challenge.email !== email) {
      return {
        valid: false,
        validationError:
          'Verification code does not match the specified email.',
      };
    }

    // Check if challenge has been used
    if (challenge.used) {
      return {
        valid: false,
        validationError: 'Verification code has already been used.',
      };
    }

    // Check if challenge has expired
    if (challenge.expiryTimestampMs < Date.now()) {
      return {
        valid: false,
        validationError: 'Verification code has expired.',
      };
    }

    // Get the user associated with the challenge
    const user = await getCouchUserFromEmailOrUserId(challenge.userId);
    if (!user) {
      return {
        valid: false,
        validationError: 'Could not find associated user.',
      };
    }

    // All checks passed
    return {
      valid: true,
      user,
      challenge,
    };
  } catch (error) {
    console.error(
      'Unhandled error validating verification challenge. Code: ',
      code,
      ' Error: ',
      error,
      console.trace()
    );
    return {
      valid: false,
      validationError: 'Internal server error',
    };
  }
};

/**
 * Marks a verification challenge as used.
 *
 * @param code - The verification code to mark as used (can be raw or hashed)
 * @param isHashed - Whether the provided code is already hashed
 * @returns A Promise that resolves to the updated verification challenge document
 */
export const consumeVerificationChallenge = async ({
  code,
  isHashed = false,
}: {
  code: string;
  isHashed?: boolean;
}): Promise<VerificationChallengeExistingDocument> => {
  // Hash the code if not already hashed
  const hashedCode = isHashed ? code : hashChallengeCode(code);

  // Find the challenge
  const challenge = await getVerificationChallengeByCode({code: hashedCode});

  // Check if challenge exists
  if (!challenge) {
    throw new ItemNotFoundException(
      'Could not find the specified verification code.'
    );
  }

  // Mark the challenge as used
  challenge.used = true;

  // Update the document in the database
  const authDB = getAuthDB();
  await safeWriteDocument({db: authDB, data: challenge});

  return challenge;
};

/**
 * Retrieves verification challenges for a given user.
 *
 * @param userId - The ID of the user whose challenges are being retrieved
 * @returns A Promise that resolves to an array of verification challenge documents
 */
export const getVerificationChallengesByUserId = async ({
  userId,
}: {
  userId: string;
}): Promise<VerificationChallengeExistingDocument[]> => {
  const authDB = getAuthDB();

  // Query the database for challenges by user ID
  const result = await authDB.query<VerificationChallengeExistingDocument>(
    'viewsDocument/verificationChallengesByUserId',
    {
      key: userId,
      include_docs: true,
    }
  );

  // Return the challenge documents
  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};

/**
 * Retrieves verification challenges for a given email.
 *
 * @param email - The email address for which to retrieve challenges
 * @returns A Promise that resolves to an array of verification challenge documents
 */
export const getVerificationChallengesByEmail = async ({
  email,
}: {
  email: string;
}): Promise<VerificationChallengeExistingDocument[]> => {
  const authDB = getAuthDB();

  // Query the database for challenges by email
  const result = await authDB.query<VerificationChallengeExistingDocument>(
    'viewsDocument/verificationChallengesByEmail',
    {
      key: email,
      include_docs: true,
    }
  );

  // Return the challenge documents
  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};

/**
 * Retrieves a verification challenge by its code.
 *
 * @param code - The hashed verification code to search for
 * @returns A Promise that resolves to the verification challenge document or null if not found
 */
export const getVerificationChallengeByCode = async ({
  code,
}: {
  code: string;
}): Promise<VerificationChallengeExistingDocument | null> => {
  const authDB = getAuthDB();

  // Query the database for the challenge by code
  const result = await authDB.query<VerificationChallengeExistingDocument>(
    'viewsDocument/verificationChallengesByCode',
    {
      key: code,
      include_docs: true,
    }
  );

  // Filter and check results
  const filtered = result.rows.filter(r => !!r.doc).map(row => row.doc!);

  // No challenge found
  if (filtered.length === 0) {
    return null;
  }

  // Multiple challenges found - this should not happen
  if (filtered.length > 1) {
    throw new InternalSystemError(
      'Duplicate items sharing a verification code. Cannot validate this verification challenge.'
    );
  }

  // Return the single challenge found
  return filtered[0];
};

/**
 * Retrieves all verification challenges.
 *
 * @returns A Promise that resolves to an array of all verification challenge documents
 */
export const getAllVerificationChallenges = async (): Promise<
  VerificationChallengeExistingDocument[]
> => {
  const authDB = getAuthDB();

  // Query the database for all verification challenges
  const result = await authDB.query<VerificationChallengeExistingDocument>(
    'viewsDocument/verificationChallenges',
    {
      include_docs: true,
    }
  );

  // Return all docs
  return result.rows.filter(r => !!r.doc).map(row => row.doc!);
};
