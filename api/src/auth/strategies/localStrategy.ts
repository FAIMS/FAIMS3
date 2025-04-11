/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License"); you may not
 * use, this file except in compliance with the License. You may obtain a copy
 * of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND either express or implied. See, the
 * License, for the specific language governing permissions and limitations
 * under the License.
 *
 * Filename: local.ts
 *
 * Description: Implements the validate callback for the local passport auth
 * strategy
 */

import {pbkdf2Sync} from 'crypto';
import {Strategy, VerifyFunction} from 'passport-local';
import {upgradeCouchUserToExpressUser} from '../keySigning/create';
import {getCouchUserFromEmailOrUsername} from '../../couchdb/users';

/**
 * Interface for local authentication profile
 * Contains the hashed password and salt for password verification
 */
type LocalProfile = {
  // Hashed password stored as hex string
  password: string;
  // Salt used in password hashing
  salt: string;
};

/**
 * Validates a user attempting to log in with local credentials
 *
 * @param email - User's email or username
 * @param password - User's plaintext password
 * @param done - Passport callback function
 * @returns The run done callback with (err?, user?)
 */
export const validateLocalUser: VerifyFunction = async (
  email,
  password,
  done
): Promise<void> => {
  const ambiguousErrorMessage = 'Username or password incorrect.';

  // Look up user in database by email or username
  const dbUser = await getCouchUserFromEmailOrUsername(email);

  // Handle case where user doesn't exist
  if (!dbUser) {
    return done(ambiguousErrorMessage, false);
  }

  // Get the local authentication profile for the user
  const profile = dbUser.profiles['local'] as LocalProfile;

  // Handle case where user exists but has no local profile (uses social auth
  // instead)
  if (!profile) {
    return done(
      `You are trying to login to an account which has been created using a social provider. Please login using the social provider instead.`,
      false
    );
  }

  // Handle case where profile exists but salt is missing (corrupted user data)
  if (!profile.salt) {
    return done(
      `Please contact a system administrator. There was an issue logging you in.`,
      false
    );
  }

  // Hash the provided password with the stored salt using PBKDF2
  // 100000 iterations, 64 byte output length, SHA-256 hash function
  const hashedPassword = pbkdf2Sync(
    password,
    profile.salt,
    100000,
    64,
    'sha256'
  );

  // Compare the computed hash with the stored password hash
  if (hashedPassword.toString('hex') === profile.password) {
    // Password matches - convert CouchDB user to Express user and authenticate
    return done(null, await upgradeCouchUserToExpressUser({dbUser}));
  } else {
    // Password doesn't match
    return done(ambiguousErrorMessage, false);
  }
};

/**
 * Creates and returns a configured Passport local authentication strategy
 *
 * @returns Configured Passport local authentication strategy
 */
export const getLocalAuthStrategy = () => {
  // Create the strategy with custom field names and session configuration
  return new Strategy(
    {
      passwordField: 'password',
      usernameField: 'email',
      // Do not persist the user into the session
      session: false,
    },
    validateLocalUser
  );
};
