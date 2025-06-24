/**
 * Long Lived Token API Module
 *
 * This module provides API endpoints for managing long-lived API tokens.
 * It includes functionality for creating, updating, and revoking tokens.
 */

import {
  Action,
  PostCreateLongLivedTokenRequestSchema,
  PostCreateLongLivedTokenResponse,
  PutUpdateLongLivedTokenRequestSchema,
  PutUpdateLongLivedTokenResponse,
  PutRevokeLongLivedTokenRequestSchema,
  PutRevokeLongLivedTokenResponse,
  GetLongLivedTokensResponse,
} from '@faims3/data-model';
import express, {Response} from 'express';
import {processRequest} from 'zod-express-middleware';
import {
  createNewLongLivedToken,
  updateLongLivedToken,
  revokeLongLivedToken,
  getTokensByUserId,
  getTokenById,
  getMaxAllowedExpiryTimestamp,
  getAllTokens,
} from '../couchdb/longLivedTokens';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
  userCanDo,
} from '../middleware';
import {MAXIMUM_LONG_LIVED_DURATION_DAYS} from '../buildconfig';
import {z} from 'zod';

export const api = express.Router();

/**
 * POST /
 * Creates a new long-lived API token for the authenticated user.
 * Requires user authentication and CREATE_LONG_LIVED_TOKEN permission.
 *
 * @param req.body.title - Human readable name for the token
 * @param req.body.description - Description of what the token is used for
 * @param req.body.expiryTimestampMs - Expiry timestamp in milliseconds, or null for infinite (if allowed)
 * @returns 201 - Token created successfully
 * @returns 400 - Invalid request data
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden
 */
api.post(
  '/',
  processRequest({
    body: PostCreateLongLivedTokenRequestSchema,
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    action: Action.CREATE_LONG_LIVED_TOKEN,
  }),
  async (req, res: Response<PostCreateLongLivedTokenResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const {title, description, expiryTimestampMs} = req.body;
    const user = req.user;

    try {
      const {record, token} = await createNewLongLivedToken({
        userId: user.user_id,
        title,
        description,
        expiryTimestampMs,
      });

      res.status(201).json({
        id: record._id,
        title: record.title,
        description: record.description,
        token, // Only returned on creation
        enabled: record.enabled,
        createdAt: record.createdTimestampMs,
        updatedAt: record.updatedTimestampMs,
        expiresAt: record.expiryTimestampMs,
        lastUsedAt: record.lastUsedTimestampMs,
        userId: record.userId,
      });
    } catch (error) {
      if (error instanceof Exceptions.InvalidRequestException) {
        throw error;
      }
      throw new Exceptions.InternalSystemError(
        `Failed to create long-lived token: ${(error as Error).message}`
      );
    }
  }
);

/**
 * GET /
 * Retrieves all long-lived tokens for the authenticated user.
 * Requires user authentication.
 *
 * If the query parameter 'all' is set to 'true', it retrieves all tokens
 *
 * @returns 200 - List of user's tokens (without token values)
 * @returns 401 - Unauthorized
 */
api.get(
  '/',
  processRequest({
    query: z.object({
      // get all of the tokens, not just current user's - for admins
      all: z.string().optional(),
    }),
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    getAction(req) {
      // If the query parameter 'all' is set to 'true', require reading any
      // long-lived tokens
      if (
        ((req.query?.all as string | undefined) ?? '').toLowerCase() === 'true'
      ) {
        return Action.READ_ANY_LONG_LIVED_TOKENS;
      }
      // Otherwise, just read the user's own long-lived tokens
      return Action.READ_MY_LONG_LIVED_TOKENS;
    },
  }),
  async (req, res: Response<GetLongLivedTokensResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const user = req.user;
    const all = (req.query.all ?? '').toLowerCase() === 'true';

    try {
      let tokens;
      if (all) {
        tokens = await getTokensByUserId(user.user_id);
      } else {
        tokens = await getAllTokens();
      }

      const tokenList = tokens.map(token => ({
        id: token._id,
        title: token.title,
        description: token.description,
        enabled: token.enabled,
        createdAt: token.createdTimestampMs,
        updatedAt: token.updatedTimestampMs,
        expiresAt: token.expiryTimestampMs,
        lastUsedAt: token.lastUsedTimestampMs,
        userId: token.userId,
      }));

      res.json({
        tokens: tokenList,
        maxAllowedExpiryTimestamp: getMaxAllowedExpiryTimestamp(),
        maxDurationDays: MAXIMUM_LONG_LIVED_DURATION_DAYS,
      });
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        `Failed to retrieve tokens: ${(error as Error).message}`
      );
    }
  }
);

/**
 * PUT /:tokenId
 * Updates the metadata of an existing long-lived token.
 * Users can only update their own tokens unless they have EDIT_ALL_TOKENS permission.
 *
 * @param req.params.tokenId - The ID of the token to update
 * @param req.body.title - New title for the token
 * @param req.body.description - New description for the token
 * @returns 200 - Token updated successfully
 * @returns 400 - Invalid request data
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden
 * @returns 404 - Token not found
 */
api.put(
  '/:tokenId',
  processRequest({
    body: PutUpdateLongLivedTokenRequestSchema,
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    // they at least need to be able to edit their own tokens
    action: Action.EDIT_MY_LONG_LIVED_TOKEN,
  }),
  async (req, res: Response<PutUpdateLongLivedTokenResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const {tokenId} = req.params;
    const {title, description} = req.body;
    const user = req.user;

    try {
      // First, get the token to check ownership
      const existingToken = await getTokenById(tokenId);

      // Check if user owns the token or has permission to edit all tokens
      const canEditToken =
        existingToken.userId === user.user_id ||
        userCanDo({user, action: Action.EDIT_ANY_LONG_LIVED_TOKEN});

      if (!canEditToken) {
        throw new Exceptions.UnauthorizedException(
          'You do not have permission to edit this token.'
        );
      }

      const updatedToken = await updateLongLivedToken(tokenId, {
        title,
        description,
      });

      res.json({
        id: updatedToken._id,
        title: updatedToken.title,
        description: updatedToken.description,
        enabled: updatedToken.enabled,
        createdAt: updatedToken.createdTimestampMs,
        updatedAt: updatedToken.updatedTimestampMs,
        expiresAt: updatedToken.expiryTimestampMs,
        lastUsedAt: updatedToken.lastUsedTimestampMs,
        userId: updatedToken.userId,
      });
    } catch (error) {
      if (error instanceof Exceptions.ItemNotFoundException) {
        throw error;
      }
      if (error instanceof Exceptions.UnauthorizedException) {
        throw error;
      }
      throw new Exceptions.InternalSystemError(
        `Failed to update token: ${(error as Error).message}`
      );
    }
  }
);

/**
 * PUT /:tokenId/revoke
 * Revokes (disables) an existing long-lived token.
 * Users can only revoke their own tokens unless they have EDIT_ALL_TOKENS permission.
 *
 * @param req.params.tokenId - The ID of the token to revoke
 * @returns 200 - Token revoked successfully
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden
 * @returns 404 - Token not found
 */
api.put(
  '/:tokenId/revoke',
  processRequest({
    body: PutRevokeLongLivedTokenRequestSchema,
  }),
  requireAuthenticationAPI,
  isAllowedToMiddleware({
    // they at least need to be able to edit their own tokens
    action: Action.REVOKE_MY_LONG_LIVED_TOKEN,
  }),
  async (req, res: Response<PutRevokeLongLivedTokenResponse>) => {
    if (!req.user) {
      throw new Exceptions.UnauthorizedException('Not authenticated.');
    }

    const {tokenId} = req.params;
    const user = req.user;

    try {
      // First, get the token to check ownership
      const existingToken = await getTokenById(tokenId);

      // Check if user owns the token or has permission to edit all tokens
      const canEditToken =
        existingToken.userId === user.user_id ||
        userCanDo({user, action: Action.REVOKE_ANY_LONG_LIVED_TOKEN});

      if (!canEditToken && existingToken.userId !== user.user_id) {
        throw new Exceptions.UnauthorizedException(
          'You do not have permission to revoke this token.'
        );
      }

      const revokedToken = await revokeLongLivedToken(tokenId);

      res.json({
        id: revokedToken._id,
        title: revokedToken.title,
        description: revokedToken.description,
        enabled: revokedToken.enabled,
        createdAt: revokedToken.createdTimestampMs,
        updatedAt: revokedToken.updatedTimestampMs,
        expiresAt: revokedToken.expiryTimestampMs,
        lastUsedAt: revokedToken.lastUsedTimestampMs,
        userId: revokedToken.userId,
        message: 'Token has been successfully revoked.',
      });
    } catch (error) {
      if (error instanceof Exceptions.ItemNotFoundException) {
        throw error;
      }
      if (error instanceof Exceptions.UnauthorizedException) {
        throw error;
      }
      throw new Exceptions.InternalSystemError(
        `Failed to revoke token: ${(error as Error).message}`
      );
    }
  }
);

export default api;
