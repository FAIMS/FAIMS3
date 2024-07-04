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

import {jwtVerify} from 'jose';
import {getUserFromEmailOrUsername} from '../couchdb/users';
import {getSigningKey} from './signing_keys';

/**
 * validateToken
 * @param token bearer token received in a request
 * @returns Details of the verified user or undefined
 */
export const validateToken = async (token: string) => {
  const signingKey = await getSigningKey();
  //console.log(`verifying token: '${token}'`);
  try {
    const {payload} = await jwtVerify(token, signingKey.public_key, {
      algorithms: [signingKey.alg],
    });

    //console.log('Token Payload', payload);

    if (payload.sub) {
      const user = await getUserFromEmailOrUsername(payload.sub);
      return user;
    } else {
      return undefined;
    }
  } catch (error) {
    console.error(error);
    return undefined;
  }
};
