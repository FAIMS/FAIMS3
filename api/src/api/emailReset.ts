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
} from '../couchdb/emailCodes';
import {getUserFromEmailOrUsername, updateUserPassword} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {isAllowedToMiddleware, requireAuthenticationAPI} from '../middleware';

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
    const {email} = req.body;

    // Get the user by email
    const user = await getUserFromEmailOrUsername(email);
    if (!user) {
      throw new Exceptions.ItemNotFoundException(
        'No user found with the specified email address.'
      );
    }

    // Generate reset code
    const {code} = await createNewEmailCode(user.user_id);
    const url = buildCodeIntoUrl(code);

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
