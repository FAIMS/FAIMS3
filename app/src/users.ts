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
 * Filename: users.ts
 * Description:
 *   This contains the user/visibility control subsystem, and management/storage
 *   of access tokens. This does not do access control (as that must be handled
 *   by couchdb).but instead tries to avoid exposing information to keep users
 *   on the happy path of not seeing access denied, or at least in ways the GUI
 *   can meaningfully handle.
 */
import {decodeJwt} from 'jose';

import {
  Action,
  decodeAndValidateToken,
  isAuthorized,
  RecordMetadata,
  TokenContents,
  TokenPermissions,
} from '@faims3/data-model';
import {IGNORE_TOKEN_EXP} from './buildconfig';

/**
 * Decodes JWT ready for use in app.
 *
 * NOTE: This does not validate the token. This does not check expiry. Decodes
 * the token and puts into TokenContents.
 *
 * NOTE: If IGNORE_TOKEN_EXP = true, then the exp is spoofed
 *
 * @param token The raw JWT
 * @returns The parsed token as a TokenContents object
 */
export function parseToken(token: string): TokenContents {
  const payload = decodeJwt(token);

  const username = payload.sub ?? undefined;

  // Either interpret exp from the JWT or if the backwards compatibility build
  // flag is used, will spoof an expiry one year from now.
  let exp: number | undefined = undefined;
  if (IGNORE_TOKEN_EXP) {
    // a year from now
    exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  } else {
    exp = payload.exp;
  }

  const server = payload['server'] as string | undefined;

  // These are all required
  if (!exp) {
    console.error('Cannot accept a JWT which has no exp field defined.');
    throw new Error('Cannot accept a JWT which has no exp field defined.');
  }
  if (!server) {
    throw Error('Server not specified in token');
  }
  if (username === undefined) {
    throw Error('Username not specified in token');
  }

  const name = (payload['name'] as string) ?? undefined;
  const decodedRoles = decodeAndValidateToken(payload as TokenPermissions);

  return {
    username: username,
    name: name,
    server: server,
    exp,
    ...decodedRoles,
  };
}

export async function shouldDisplayRecord({
  contents,
  recordMetadata: record_metadata,
  projectId,
}: {
  contents: TokenContents;
  projectId: string;
  recordMetadata: RecordMetadata;
}): Promise<boolean> {
  const userId = contents.username;
  // Always display your own records
  if (record_metadata.created_by === userId) {
    return isAuthorized({
      decodedToken: contents,
      action: Action.READ_MY_PROJECT_RECORDS,
      resourceId: projectId,
    });
  } else {
    return isAuthorized({
      decodedToken: contents,
      action: Action.READ_ALL_PROJECT_RECORDS,
      resourceId: projectId,
    });
  }
}
