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
import {PeopleDBDocument} from '@faims3/data-model';

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
 * Result of verifying a user's credentials
 */
export type VerifyUserResult = {
  // Whether the verification succeeded
  success: boolean;
  // Error message if verification failed
  error?: string;
  // The user document if verification succeeded
  user?: PeopleDBDocument;
};

/**
 * Verifies a user's credentials by username/email and password
 *
 * @param username - User's email or username
 * @param password - User's plaintext password
 * @returns Promise resolving to the verification result
 */
export const verifyUserCredentials = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<VerifyUserResult> => {
  const ambiguousErrorMessage = 'Username or password incorrect.';

  // Look up user in database by email or username
  const dbUser = await getCouchUserFromEmailOrUsername(username);

  // Handle case where user doesn't exist
  if (!dbUser) {
    return {
      success: false,
      error: ambiguousErrorMessage,
    };
  }

  // Get the local authentication profile for the user
  const profile = dbUser.profiles['local'] as LocalProfile;

  // Handle case where user exists but has no local profile (uses social auth instead)
  if (!profile) {
    return {
      success: false,
      error:
        'You are trying to login to an account which has been created using a social provider. Please login using the social provider instead.',
    };
  }

  // Handle case where profile exists but salt is missing (corrupted user data)
  if (!profile.salt) {
    return {
      success: false,
      error:
        'Please contact a system administrator. There was an issue logging you in.',
    };
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
    // Password matches
    return {
      success: true,
      user: dbUser,
    };
  } else {
    // Password doesn't match
    return {
      success: false,
      error: ambiguousErrorMessage,
    };
  }
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
  const result = await verifyUserCredentials({username: email, password});

  if (result.success && result.user) {
    // If verification succeeded, upgrade to Express user and authenticate
    return done(
      null,
      await upgradeCouchUserToExpressUser({dbUser: result.user})
    );
  } else {
    // If verification failed, pass the error message
    return done(result.error, false);
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
