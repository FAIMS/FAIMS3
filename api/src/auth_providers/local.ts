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

import {pbkdf2Sync, randomBytes} from 'crypto';
import {Strategy} from 'passport-local';
import {
  createUser,
  getUserFromEmailOrUsername,
  saveUser,
} from '../couchdb/users';

type LocalProfile = {
  password: string;
  salt: string;
};

// Export so that we can test
export const validateLocalUser = async (
  username: string,
  password: string,
  done: CallableFunction
) => {
  const user = await getUserFromEmailOrUsername(username);
  if (user) {
    // check the password...
    const profile = user.profiles['local'] as LocalProfile;
    if (profile.salt) {
      const hashedPassword = pbkdf2Sync(
        password,
        profile.salt,
        100000,
        64,
        'sha256'
      );
      if (hashedPassword.toString('hex') === profile.password) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    }
  }
  // fallback to failure
  return done(null, false);
};

export const get_strategy = () => {
  return new Strategy(validateLocalUser);
};

/**
 * registerLocalUser - create a new user account
 *   either `username` or `email` is required to make an account
 *   no existing account should exist with these credentials
 * @param username - a username, not previously used
 * @param email - an email address, not previously used
 * @param name - user's full name
 * @param password - a password
 * @param roles - a list of user roles
 */
export const registerLocalUser = async (
  username: string,
  email: string,
  name: string,
  password: string
): Promise<[Express.User | null, string]> => {
  const [user, error] = await createUser(email, username);
  if (user) {
    user.name = name;
    addLocalPasswordForUser(user, password);
  }
  return [user, error];
};

export const addLocalPasswordForUser = async (
  user: Express.User,
  password: string
) => {
  const salt = randomBytes(64).toString('hex');
  try {
    const hashedPassword = pbkdf2Sync(password, salt, 100000, 64, 'sha256');
    user.profiles['local'] = {
      password: hashedPassword.toString('hex'),
      salt: salt,
    };
    await saveUser(user);
  } catch {
    throw Error('Error hashing password');
  }
};
