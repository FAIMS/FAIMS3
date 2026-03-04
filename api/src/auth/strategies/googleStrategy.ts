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
 * Filename: google.ts
 * Description:
 *   This module configure the authentication using Google's OAuth2.0 interface
 */

import {
  GoogleCallbackParameters,
  Profile,
  Strategy,
  VerifyCallback,
} from 'passport-google-oauth20';

import {
  addEmails,
  ExistingPeopleDBDocument,
  VerifiableEmail,
} from '@faims3/data-model';
import {CONDUCTOR_PUBLIC_URL} from '../../buildconfig';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../../couchdb/users';
import {CustomSessionData} from '../../types';
import {identifyUser, lookupAndValidateInvite, ssoVerify} from '../helpers';
import {upgradeCouchUserToExpressUser} from '../keySigning/create';
import {providerAuthReturnUrl} from '../authRoutes';

/**
 * The verify function receives the verified profile information from an IdP
 * Authentication challenge.
 *
 * The Profile includes an ID property which we use as the lookup ID in our user
 * database.
 *
 * This function will pass through the user information if available, or null if
 * not available. It will also update an existing matched user with this profile
 * if matching by ID.
 *
 * @param req - The Express request object containing session information
 * @param accessToken - The OAuth access token received from Google
 * @param refreshToken - The OAuth refresh token for obtaining new access tokens
 * @param results - Additional data returned from the OAuth provider
 * @param profile - User profile information from the OAuth provider (Google)
 * @param done - Callback function to signal authentication success/failure
 *
 * @returns This function does not return a value but calls the done callback
 * with either (error, null) in case of failure or (null, user) in case of
 * success, optionally with additional info as a third parameter
 */
async function oauthVerify(
  req: Express.Request,
  accessToken: string,
  refreshToken: string,
  params: GoogleCallbackParameters,
  profile: Profile,
  done: VerifyCallback
): Promise<void> {
  // See what emails this google user has - filter for verified and then map
  // into actual email values NOTE: This is actually typed wrong - it is a
  // boolean not 'true' or 'false' hence why we directly use verified
  const verifiedEmails = (profile.emails ?? [])
    .filter(o => o.verified)
    .map(o => o.value);

  return ssoVerify({
    req,
    strategyId: 'google',
    displayName: 'Google',
    profile,
    emails: verifiedEmails,
    userDisplayName: profile => profile.displayName,
    done,
  });
}

export const googleStrategyGenerator = ({
  clientID,
  clientSecret,
  scope,
}: {
  clientID: string;
  clientSecret: string;
  scope: string[];
}) => {
  // This strategy handles both login and registration cases with the same
  // verify function
  const strategy = new Strategy(
    {
      clientID: clientID,
      clientSecret: clientSecret,
      callbackURL: CONDUCTOR_PUBLIC_URL + providerAuthReturnUrl('google'),
      passReqToCallback: true,
      scope,
      state: true,
    },
    oauthVerify
  );

  return strategy;
};
