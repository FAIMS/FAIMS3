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

import {SignJWT} from 'jose';
import type {SigningKey} from '../services/keyService';
import {CONDUCTOR_PUBLIC_URL, KEY_SERVICE} from '../buildconfig';

export async function createAuthKey(
  user: Express.User,
  signingKey: SigningKey
) {
  const jwt = await new SignJWT({
    '_couchdb.roles': user.roles ?? [],
    name: user.name,
    server: CONDUCTOR_PUBLIC_URL,
  })
    .setProtectedHeader({
      alg: signingKey.alg,
      kid: signingKey.kid,
    })
    .setSubject(user.user_id)
    .setIssuedAt()
    .setIssuer(signingKey.instanceName)
    // TODO reinstate expiration time
    //.setExpirationTime('2h')
    .sign(signingKey.privateKey);
  return jwt;
}

export async function generateUserToken(user: Express.User) {
  const signingKey = await KEY_SERVICE.getSigningKey();
  if (signingKey === null || signingKey === undefined) {
    throw new Error('No signing key is available, check configuration');
  } else {
    const token = await createAuthKey(user, signingKey);

    return {
      token: token,
      pubkey: signingKey.publicKeyString,
      pubalg: signingKey.alg,
    };
  }
}
