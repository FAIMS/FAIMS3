import {
  Action,
  PostRequestPasswordResetRequestSchema,
  PostRequestPasswordResetResponse,
  PutRequestPasswordResetRequestSchema,
  PutRequestPasswordResetResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {processRequest} from 'zod-express-middleware';
import {
  buildCodeIntoUrl,
  createNewEmailCode,
  markCodeAsUsed,
  validateEmailCode,
} from '../couchdb/emailReset';
import {
  getCouchUserFromEmailOrUserId,
  updateUserPassword,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';
import {
  buildPasswordResetUrl,
  buildVerificationUrl,
  sendPasswordResetEmail,
} from '../utils/emailHelpers';
import {DEFAULT_REDIRECT_URL} from '../auth/authRoutes';
import {validateRedirect} from '../auth/helpers';
import {record} from 'zod';

export const api = express.Router();

/**
 * POST /reset
 * Initiates a password reset by generating and sending a reset code.
 * Requires admin authentication.
 *
 * @route POST /reset
 * @param {object} req.body - The request body
 * @param {string} req.body.email - The email address of the user requesting reset
 * @returns {object} 200 - Success response
 * @returns {object} 401 - Unauthorized
 * @returns {object} 404 - User not found
 */
api.post(
  '/',
  processRequest({
    body: PostRequestPasswordResetRequestSchema,
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.RESET_USER_PASSWORD,
    getResourceId(req) {
      // TODO validate this is always a suitable ID to check the resource ID for
      return req.body.email;
    },
  }),
  async (req, res: Response<PostRequestPasswordResetResponse>) => {
    const {email, redirect} = req.body;

    const {valid, redirect: validatedRedirect} = validateRedirect(
      redirect || DEFAULT_REDIRECT_URL
    );

    // Get the user by email
    const user = await getCouchUserFromEmailOrUserId(email);
    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'No user found with the specified email address.'
      );
    }

    // Generate reset code
    const {code, record} = await createNewEmailCode(user.user_id);
    const url = buildPasswordResetUrl({code, redirect: validatedRedirect});

    // NOTE: we intentionally don't await this
    // so that it is harder as an attacker to tell if something happened -
    // this will complete in the background
    sendPasswordResetEmail({
      recipientEmail: email,
      username: user.name || user.user_id,
      resetCode: code,
      expiryTimestampMs: record.expiryTimestampMs,
      redirect: validatedRedirect,
    });

    res.json({
      code,
      url,
    });
  }
);

/**
 * PUT /reset
 * Completes a password reset using a valid reset code.
 * This endpoint is public but requires a valid reset code.
 *
 * @route PUT /reset
 * @param {object} req.body - The request body
 * @param {string} req.body.code - The reset code
 * @param {string} req.body.newPassword - The new password
 * @returns {object} 200 - Success response
 * @returns {object} 400 - Invalid code or password
 * @returns {object} 404 - Code not found
 */
api.put(
  '/',
  processRequest({
    body: PutRequestPasswordResetRequestSchema,
  }),
  async (req, res: Response<PutRequestPasswordResetResponse>) => {
    const {code, newPassword} = req.body;

    // Validate the reset code
    const validationResult = await validateEmailCode(code);

    if (!validationResult.valid || !validationResult.user) {
      throw new Exceptions.UnauthorizedException(
        validationResult.validationError || 'Invalid reset code.'
      );
    }

    // Update the user's password
    await updateUserPassword(validationResult.user.user_id, newPassword);

    // Mark the code as used
    await markCodeAsUsed(code);

    res.json({
      message: 'Password has been successfully reset.',
    });
  }
);

// Export the router
export default api;
