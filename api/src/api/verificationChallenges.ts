/**
 * Email Verification API Module
 *
 * This module provides endpoints for verifying user email addresses.
 * It includes functionality for requesting verification and confirming email verification.
 */

import {
  Action,
  PostRequestEmailVerificationRequestSchema,
  PostRequestEmailVerificationResponse,
  PutConfirmEmailVerificationRequestSchema,
  PutConfirmEmailVerificationResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {processRequest} from 'zod-express-middleware';
import {
  checkCanCreateVerificationChallenge,
  createVerificationChallenge,
  consumeVerificationChallenge,
  validateVerificationChallenge,
} from '../couchdb/verificationChallenges';
import {updateUserEmailVerificationStatus} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import {sendEmailVerificationChallenge} from '../utils/emailHelpers';

export const api: express.Router = express.Router();

/**
 * POST /verify
 * Initiates an email verification by generating and sending a verification code.
 * Requires user authentication.
 *
 * @param req.body.email - The email address to verify
 * @returns 200 - Success response
 * @returns 401 - Unauthorized
 * @returns 404 - User not found
 * @returns 429 - Too many verification attempts
 */
api.post(
  '/',
  processRequest({
    body: PostRequestEmailVerificationRequestSchema,
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.VERIFY_EMAIL,
  }),
  async (req, res: Response<PostRequestEmailVerificationResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const {email} = req.body;
    const user = req.user;

    // Check if the email belongs to the user
    const userEmails = user.emails.map(e => e.email);
    if (!userEmails.includes(email)) {
      throw new Exceptions.UnauthorizedException(
        'The specified email is not associated with this user account.'
      );
    }

    if (user.emails.find(e => e.email === email)?.verified) {
      throw new Exceptions.InvalidRequestException(
        'This email address is already verified!'
      );
    }

    // Check if verification attempt is allowed
    const canCreate = await checkCanCreateVerificationChallenge({
      userId: user.user_id,
      email,
    });

    if (!canCreate.canCreate) {
      throw new Exceptions.TooManyRequestsException(
        canCreate.reason || 'Too many verification attempts'
      );
    }

    // Create verification challenge
    const {code, record} = await createVerificationChallenge({
      userId: user.user_id,
      email,
    });

    // Send verification email (this would be implemented in the email service)
    await sendEmailVerificationChallenge({
      recipientEmail: email,
      verificationCode: code,
      username: user.name,
      expiryTimestampMs: record.expiryTimestampMs,
    });

    res.json({
      message: 'Verification email has been sent.',
      email,
      expiresAt: record.expiryTimestampMs,
    });
  }
);

/**
 * Verifies an email using a verification code.
 *
 * @param code The verification code
 * @returns A Promise that resolves to an object with the verification result
 */
export async function verifyEmailWithCode({code}: {code: string}): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    // Validate the verification code
    const validationResult = await validateVerificationChallenge({
      code,
    });

    if (
      !validationResult.valid ||
      !validationResult.user ||
      !validationResult.challenge
    ) {
      return {
        success: false,
        error: validationResult.validationError || 'Invalid verification code.',
      };
    }

    // Get the verified email from the challenge
    const verifiedEmail = validationResult.challenge.email;

    // Update the user's email verification status
    await updateUserEmailVerificationStatus({
      userId: validationResult.user._id,
      email: verifiedEmail,
      verified: true,
    });

    // Mark the verification code as used
    await consumeVerificationChallenge({code});

    return {
      success: true,
      email: verifiedEmail,
    };
  } catch (error) {
    console.error('Error verifying email:', error);
    return {
      success: false,
      error: 'An error occurred while verifying your email.',
    };
  }
}

/**
 * PUT /verify
 *
 * Completes an email verification using a valid verification code.
 * This endpoint is public but requires a valid verification code.
 *
 * @param req.body.code - The verification code
 * @param req.body.email - Optional email to verify
 * @returns 200 - Success response
 * @returns 400 - Invalid code
 * @returns 404 - Code not found
 */
api.put(
  '/',
  processRequest({
    body: PutConfirmEmailVerificationRequestSchema,
  }),
  async (req, res: Response<PutConfirmEmailVerificationResponse>) => {
    const {code} = req.body;

    const result = await verifyEmailWithCode({code});

    if (!result.success) {
      throw new Exceptions.UnauthorizedException(
        result.error || 'Invalid verification code.'
      );
    }

    res.json({
      message: 'Email has been successfully verified.',
      email: result.email!,
    });
  }
);
