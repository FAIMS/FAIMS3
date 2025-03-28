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
 * Filename: src/authkeys/create.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {couchUserToTokenPermissions, TokenPayload} from '@faims3/data-model';
import {SignJWT} from 'jose';
import {
  ACCESS_TOKEN_EXPIRY_MINUTES,
  CONDUCTOR_PUBLIC_URL,
  KEY_SERVICE,
} from '../buildconfig';
import {createNewRefreshToken} from '../couchdb/refreshTokens';
import type {SigningKey} from '../services/keyService';

export async function generateJwtFromUser({
  user,
  signingKey,
}: {
  user: Express.User;
  signingKey: SigningKey;
}) {
  // The data model provides this encoding method - it takes the couch user
  // details and determines how to put that into the token
  const permissionsComponent = couchUserToTokenPermissions({...user});
  // We then augment this with extra details to help identify the origin of the
  // token + user details
  const completePayload: TokenPayload = {
    ...permissionsComponent,
    name: user.name,
    server: CONDUCTOR_PUBLIC_URL,
  };

  // Then there are other parts we wish to include
  const jwt = await new SignJWT(completePayload)
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
    })
    .setSubject(user.user_id)
    .setIssuedAt()
    .setIssuer(signingKey.instanceName)
    // Expiry in minutes
    .setExpirationTime(ACCESS_TOKEN_EXPIRY_MINUTES.toString() + 'm')
    .sign(signingKey.privateKey);
  return jwt;
}

/**
 * Generates a token for a user. Also generates a reusable refresh token.
 * @param user The passport user
 * @returns The generated token which is a payload containing the actual JWT + refresh token + other information
 */
export async function generateUserToken(user: Express.User, refresh = false) {
  const signingKey = await KEY_SERVICE.getSigningKey();
  if (signingKey === null || signingKey === undefined) {
    throw new Error('No signing key is available, check configuration');
  } else {
    const token = await generateJwtFromUser({user, signingKey});

    return {
      token: token,
      // Provide a refresh token if necessary
      refreshToken: refresh
        ? (await createNewRefreshToken(user._id!)).token
        : undefined,
      pubkey: signingKey.publicKeyString,
      pubalg: signingKey.alg,
    };
  }
}
