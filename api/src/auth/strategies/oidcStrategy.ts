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
import {lookupAndValidateInvite} from '../helpers';
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
    // pull out session info (and type it - this route really doesn't want to
    // accept our typing overrides in types.ts)
    const {action, inviteId} = req.session as CustomSessionData;

    // Action should always be defined
    if (!action) {
      return done(
        new Error(
          'No action provided during identity provider redirection - cannot proceed. Contact system administrator.'
        ),
        undefined
      );
    }

    // Registration requires an invite ID - but handling of the invite is not the
    // responsibility of this module - see the success callback in authRoutes
    if (action === 'register' && !inviteId) {
      return done(
        new Error(
          'Trying to register a new account without an invitation - this is not authorised.'
        ),
        undefined
      );
    }

    // NB OIDC does not distinguish verified emails so assume all provided are good
    const profileEmails = (profile.emails ?? []).map(o => o.value);

    if (profileEmails.length === 0) {
      // indicate error since there are no valid email addresses!
      return done(
        new Error(
          `The ${displayName} user does not have any verified email addresses, and therefore cannot be logged in.`
        ),
        undefined
      );
    }

    // so they have at least one valid email address - let's see if we can find
    // precisely ONE profile that matches
    const userLookups: {[email: string]: ExistingPeopleDBDocument | null} = {};

    for (const targetEmail of profileEmails) {
      // Try to get the user based on the target email
      userLookups[targetEmail] =
        await getCouchUserFromEmailOrUserId(targetEmail);
    }

    const matchingEmails = Object.entries(userLookups)
      .filter(([, potentialUser]) => !!potentialUser)
      .map(([email]) => email);

    // create a list of unique matched accounts - this way if you match on
    // multiple email addresses, but already merged into a single account, this is
    // managed properly
    const matchingAccounts: ExistingPeopleDBDocument[] = [];
    for (const email of matchingEmails) {
      const user = userLookups[email]!;
      if (!matchingAccounts.map(acc => acc._id).includes(user._id)) {
        matchingAccounts.push(user);
      }
    }

    // So they have some existing match - is it more than one, this is an error
    // state - we shouldn't have a google profile linking to multiple accounts!
    // Confusing situation let's not allow this.
    if (matchingAccounts.length > 1) {
      return done(
        new Error(
          `The users ${displayName} profile included more than one email address, of which more than one match existing accounts. Unsure how to proceed.`
        ),
        undefined
      );
    }

    if (action === 'login') {
      // LOGIN
      // =====

      // This is a situation where they do have a verified email address but none
      // match
      if (matchingAccounts.length === 0) {
        // We abort here - this is an error
        return done(
          new Error(
            `This ${displayName} user account does not exist in our system. Instead, you should register for a new account by using an invite code shared with you.`
          ),
          undefined
        );
      }

      // We have precisely one matching email address, let's ensure that this
      // account has the linked google profile, then return it (We can safely assert
      // non-null here due to our previous filtering)
      const matchedSingleUser = matchingAccounts[0];

      // Firstly - ensure they have the profile linked
      if (!(strategyId in matchedSingleUser.profiles)) {
        matchedSingleUser.profiles[strategyId] = profile;
        await saveCouchUser(matchedSingleUser);
      }

      // upgrade user and return login success - invite to be processed later if
      // at all
      return done(
        null,
        await upgradeCouchUserToExpressUser({dbUser: matchedSingleUser})
      );
    } else {
      // REGISTER
      // ========

      // Validate invite - always needed
      try {
        await lookupAndValidateInvite({inviteCode: inviteId!});
      } catch (e) {
        return done(
          new Error('Invalid invite provided. Cannot register an account.'),
          undefined
        );
      }

      // This is scenario where this user does not yet exist - so let's create
      // them (checking invite is okay)
      if (matchingAccounts.length === 0) {
        // So the invite is valid we should now start to setup the user
        const [newDbUser] = await createUser({
          // Use the first email (assumed okay to be primary lookup email)
          email: profileEmails[0],
          username: profileEmails[0],
          name: profile.displayName,
          verified: true,
        });

        // something went wrong here
        if (!newDbUser) {
          throw Error(
            'Internal system error: unable to create new user! Contact a system administrator.'
          );
        }

        // add the aff profile info
        newDbUser.profiles[strategyId] = profile;

        // add the other emails to the user emails array if necessary
        addEmails({
          user: newDbUser,
          emails: profileEmails.map(vEmail => {
            // Mark as verified!
            return {email: vEmail, verified: true} satisfies VerifiableEmail;
          }),
        });

        // save the user
        await saveCouchUser(newDbUser);

        // return express user
        return done(
          null,
          await upgradeCouchUserToExpressUser({dbUser: newDbUser})
        );
      }

      // NOTE: This is the situation where you are trying to 'register' a new
      // account but one already exists with google with matching email - we
      // decide here to instead log them in - upgrading the potentially
      // unconnected account

      // We have precisely one matching email address, let's ensure that this
      // account has the linked google profile, then return it (We can safely assert
      // non-null here due to our previous filtering)
      const matchedSingleUser = matchingAccounts[0];

      // Firstly - ensure they have the google profile linked
      if (!(strategyId in matchedSingleUser.profiles)) {
        matchedSingleUser.profiles[strategyId] = profile;
      }

      // add the other emails to the user emails array if necessary
      addEmails({
        user: matchedSingleUser,
        emails: profileEmails.map(vEmail => {
          // Mark as verified!
          return {email: vEmail, verified: true} satisfies VerifiableEmail;
        }),
      });

      await saveCouchUser(matchedSingleUser);

      // upgrade user and return login success - invite to be processed later if
      // at all
      return done(
        null,
        await upgradeCouchUserToExpressUser({dbUser: matchedSingleUser})
      );
    }
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
