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
 * Filename: src/authkeys/read.ts
 * Description:
 *   Provides a function to validate a user token and return user details
 */

import {decodeAndValidateToken} from '@faims3/data-model';
import {jwtVerify, errors as joseErrors} from 'jose';
import {CONDUCTOR_PUBLIC_URL, KEY_SERVICE} from '../../buildconfig';
import {getCouchUserFromEmailOrUserId} from '../../couchdb/users';

/**
 * validateToken
 * @param token bearer token received in a request
 * @returns Details of the verified user or undefined
 */
export const validateToken = async (
  token: string
): Promise<Express.User | undefined> => {
  const signingKey = await KEY_SERVICE.getSigningKey();
  try {
    const {payload} = await jwtVerify(token, signingKey.publicKey, {
      algorithms: [signingKey.alg],
      // verify issuer
      issuer: signingKey.instanceName,
    });

    if (payload.server !== CONDUCTOR_PUBLIC_URL) {
      throw Error('Invalid server claim.');
    }

    if (!payload.sub) {
      throw Error('No sub claim!');
    }

    const user = await getCouchUserFromEmailOrUserId(payload.sub);
    if (!user) {
      // TODO here we could check more sophisticated things
      throw Error('User not present in database.');
    }

    // Better to use the token provided to build the user! This ensures
    // synchronisation between API resources and the client's browser.
    // NOTE we intentionally ANY this since zod validation occurs
    const validatedToken = decodeAndValidateToken({...(payload as any)});

    // TODO consider if we want a more sophisticated permission merge, for
    // example in the case of blacklisting

    // overwrite user details with the token permissions!
    return {...user, ...validatedToken};
  } catch (error) {
    // expired token is ok, we just return undefined
    if (
      error instanceof joseErrors.JWTExpired &&
      error.code === 'ERR_JWT_EXPIRED'
    ) {
      return undefined;
    }
    // otherwise we log the error and return undefined
    console.error('Error validating token:', error);
    return undefined;
  }
};
