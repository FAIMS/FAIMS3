/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: src/middleware.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {
  Action,
  isAuthorized,
  PeopleDBDocument,
  ResourceRole,
} from '@faims3/data-model';
import Express from 'express';
import {validateToken} from './authkeys/read';
import * as Exceptions from './exceptions';

export const userCanDo = ({
  user,
  action,
  resourceId,
}: {
  // NOTE: cannot use Express.User here for some reason :/
  user: PeopleDBDocument & {resourceRoles: ResourceRole[]};
  action: Action;
  resourceId?: string;
}) => {
  return isAuthorized({
    decodedToken: {
      globalRoles: user.globalRoles,
      resourceRoles: user.resourceRoles,
    },
    action,
    resourceId,
  });
};

/**
 * Extracts the Bearer token from the Authorization header of an Express
 * request.
 *
 * @param req - The Express request object
 * @returns The Bearer token without the 'Bearer ' prefix if present, otherwise
 * undefined
 */
export function extractBearerToken(req: Express.Request): string | undefined {
  // Get the Authorization header from the request
  const authHeader = req.headers.authorization;

  // Check if the Authorization header exists and starts with 'Bearer '
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Extract the token by removing the 'Bearer ' prefix
    const token = authHeader.substring(7);
    return token;
  }

  // Return undefined if no valid Bearer token is found
  return undefined;
}

/*
 * Similar but for use in the API, just return an unuthorised repsonse
 * should check for an Authentication header...see passport-http-bearer
 */
export async function requireAuthenticationAPI(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({error: 'authentication required'});
    return;
  }

  const user = await validateToken(token);

  if (!user) {
    res.status(401).json({error: 'authentication required'});
    return;
  }

  // insert user into the request
  req.user = user;
  next();
}

export const isAllowedToMiddleware = ({
  action,
  getAction,
  getResourceId,
}: {
  action?: Action;
  getAction?: (req: Express.Request) => Action;
  getResourceId?: (req: Express.Request) => string | undefined;
}) => {
  return (
    req: Express.Request,
    res: Express.Response,
    next: Express.NextFunction
  ) => {
    if (!action && !getAction) {
      throw new Exceptions.InternalSystemError(
        'Invalid use of isAllowedToMiddleware - must provide either an action or getAction'
      );
    }
    if (action && getAction) {
      throw new Exceptions.InternalSystemError(
        'Ambiguous usage of isAllowedToMiddleware - must provide either an action or getAction, not both!'
      );
    }

    // ascertain relevant action by either direct provision or function from req object
    let relevantAction: Action;
    if (action) {
      relevantAction = action;
    } else {
      relevantAction = getAction!(req);
    }

    const user = req.user;
    if (!user) {
      throw new Exceptions.UnauthorizedException('Authentication required.');
    }

    const resourceId = getResourceId ? getResourceId(req) : undefined;

    const isAllowed = isAuthorized({
      decodedToken: {
        globalRoles: user.globalRoles,
        resourceRoles: user.resourceRoles,
      },
      action: relevantAction,
      resourceId,
    });

    if (isAllowed) {
      next();
    } else {
      throw new Exceptions.UnauthorizedException(
        'You are not authorized to perform this action.'
      );
    }
  };
};
/**
 * Opportunistically parses the user and populates req.user from DB if JWT is
 * valid. If not, then passes through with no-op.
 *
 * NOTE not to be used for endpoint which **requires** JWT auth - intended to be
 * used to enhance open endpoints with user information where available, or
 * where authorisation logic is more complex and must be handled within the
 * route.
 *
 * @param req The express request
 * @param res The express response - not necessary here
 * @param next The next function to pass through
 * @returns A req.user which is populated iff the JWT is valid and relevant for
 * user in DB
 */
export async function optionalAuthenticationJWT(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  if (req.user) {
    next();
    return;
  } else {
    const token = extractBearerToken(req);

    // just pass through if no token - no op
    if (!token) {
      next();
      return;
    }

    const user = await validateToken(token);

    if (!user) {
      next();
      return;
    }

    // insert user into the request
    req.user = user;
    next();
  }
}

export function requireNotebookMembership(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  if (req.user) {
    const project_id = req.params.notebook_id;
    if (
      userCanDo({
        user: req.user,
        resourceId: project_id,
        action: Action.READ_PROJECT_METADATA,
      })
    ) {
      next();
    } else {
      res.status(404).end();
    }
  } else {
    res.redirect('/auth/');
  }
}
