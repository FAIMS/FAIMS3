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

import Express from 'express';
import {validateToken} from './authkeys/read';
import {userHasPermission, userIsClusterAdmin} from './couchdb/users';

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
 * Middleware to ensure that the route is only accessible to logged in users
 */
export function requireAuthentication(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  if (req.user) {
    next();
  } else {
    res.redirect('/auth/');
  }
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
  if (req.user) {
    next();
    return;
  } else {
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
}

export function requireNotebookMembership(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  if (req.user) {
    const project_id = req.params.notebook_id;
    if (userHasPermission(req.user, project_id, 'read')) {
      next();
    } else {
      res.status(404).end();
    }
  } else {
    res.redirect('/auth/');
  }
}

export function requireClusterAdmin(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  if (req.user) {
    if (userIsClusterAdmin(req.user)) {
      next();
    } else {
      res.status(401).end();
    }
  } else {
    res.redirect('/auth/');
  }
}
