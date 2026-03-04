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
 * Description:
 *   This module configure the authentication using the Australian Access Federation (AAF) OIDC provider
 */

import {Profile, Strategy, VerifyCallback} from 'passport-openidconnect';

import {
  addEmails,
  ExistingPeopleDBDocument,
  VerifiableEmail,
} from '@faims3/data-model';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../../couchdb/users';
import {CustomSessionData} from '../../types';
import {lookupAndValidateInvite, ssoVerify} from '../helpers';
import {upgradeCouchUserToExpressUser} from '../keySigning/create';
import {providerAuthReturnUrl} from '../authRoutes';
import {CONDUCTOR_PUBLIC_URL} from '../../buildconfig';
import {OIDCAuthProviderConfig} from './strategyTypes';

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
 * @param profile - User profile information from the OAuth provider (Google)
 * @param done - Callback function to signal authentication success/failure
 *
 * @returns This function does not return a value but calls the done callback
 * with either (error, null) in case of failure or (null, user) in case of
 * success, optionally with additional info as a third parameter
 */
const generateOIDCVerifyFunction = ({
  strategyId,
  displayName,
}: {
  strategyId: string;
  displayName: string;
}) => {
  return async (
    req: Express.Request,
    issuer: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> => {
    // NB OIDC does not distinguish verified emails so assume all provided are good
    const profileEmails = (profile.emails ?? []).map(o => o.value);

    return ssoVerify({
      req,
      strategyId,
      displayName,
      profile,
      emails: profileEmails,
      done,
    });
  };
};

// A generator of strategy generator functions
// Given the configuration for an OIDC provider, return a function which
// generates a passport strategy for that provider
// - strategyId is the internal ID which must be a member of the AuthProvider enum
// - displayName is a human friendly name for the provider (eg. 'AAF')
// - issuer, authorizationURL, tokenURL, userInfoURL, clientID, clientSecret
//   are all as per the passport-openidconnect Strategy configuration
export const oidcStrategyGenerator = (options: OIDCAuthProviderConfig) => {
  // This strategy handles both login and registration cases with the same
  // verify function
  const strategy = new Strategy(
    {
      issuer: options.issuer,
      authorizationURL: options.authorizationURL,
      tokenURL: options.tokenURL,
      userInfoURL: options.userInfoURL,
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: CONDUCTOR_PUBLIC_URL + providerAuthReturnUrl(options.id),
      passReqToCallback: true,
      scope: options.scope,
    },
    generateOIDCVerifyFunction({
      strategyId: options.id,
      displayName: options.displayName,
    })
  );

  return strategy;
};
