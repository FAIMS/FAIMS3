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
 * Filename: local.ts
 * Description:
 *   Provides local authentication for Conductor
 */

import {pbkdf2Sync} from 'crypto';
import {Strategy, VerifyFunction} from 'passport-local';
import {upgradeCouchUserToExpressUser} from '../authkeys/create';
import {getCouchUserFromEmailOrUsername} from '../couchdb/users';

type LocalProfile = {
  password: string;
  salt: string;
};

export const validateLocalUser: VerifyFunction = async (
  email,
  password,
  done
) => {
  const dbUser = await getCouchUserFromEmailOrUsername(email);

  // User cannot be found
  if (!dbUser) {
    return done(
      `User with email ${email} does not exist. Are you sure the email is correct?`,
      false
    );
  }
  // check the password...
  const profile = dbUser.profiles['local'] as LocalProfile;

  if (!profile) {
    return done(
      `You are trying to login to an account which has been created using a social provider. Please login using the social provider instead.`,
      false
    );
  }

  if (!profile.salt) {
    return done(
      `Please contact a system administrator. Your user exists but is corrupted or cannot be ues.`,
      false
    );
  }

  const hashedPassword = pbkdf2Sync(
    password,
    profile.salt,
    100000,
    64,
    'sha256'
  );
  if (hashedPassword.toString('hex') === profile.password) {
    return done(null, await upgradeCouchUserToExpressUser({dbUser}));
  } else {
    return done('Your password is incorrect.', false);
  }
};

export const getLocalAuthStrategy = () => {
  // create the strategy based on the provided validate function
  return new Strategy(
    {
      passwordField: 'password',
      usernameField: 'username',
      // Do not persist the user into the session
      session: false,
    },
    validateLocalUser
  );
};
