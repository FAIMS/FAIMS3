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
  PeopleDBDocument,
} from '@faims3/data-model';
import {StrategyGeneratorFunction} from '.';
import {upgradeCouchUserToExpressUser} from '../authkeys/create';
import {GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET} from '../buildconfig';
import {
  createUser,
  getCouchUserFromEmailOrUsername,
  saveCouchUser,
} from '../couchdb/users';
import {CustomSessionData} from '../types';
import {handleAuthInvite} from './helpers';

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
  // pull out session info (and type it - this route really doesn't want to
  // accept our typing overrides in types.ts)
  const sessionData = req.session as CustomSessionData | undefined;

  // See what emails this google user has - filter for verified and then map
  // into actual email values NOTE: This is actually typed wrong - it is a
  // boolean not 'true' or 'false' hence why we directly use verified
  const verifiedEmails = (profile.emails ?? [])
    .filter(o => o.verified)
    .map(o => o.value);

  if (verifiedEmails.length === 0) {
    // indicate error since there are no valid email addresses!
    return done(
      'The google user does not have any verified email addresses, and therefore cannot be logged in.',
      undefined
    );
  }

  // so they have at least one valid email address - let's see if we can find
  // precisely ONE profile that matches
  const userLookups: {[email: string]: ExistingPeopleDBDocument | null} = {};

  for (const targetEmail of verifiedEmails) {
    // Try to get the user based on the target email
    userLookups[targetEmail] =
      await getCouchUserFromEmailOrUsername(targetEmail);
  }

  const matchingEmails = Object.entries(userLookups)
    .filter(([, potentialUser]) => !!potentialUser)
    .map(([email]) => email);

  // So they have some existing match - is it more than one, this is an error
  // state - we shouldn't have a google profile linking to multiple accounts!
  // Confusing situation let's not allow this.
  if (matchingEmails.length > 1) {
    return done(
      'The users google profile included more than one email address, of which more than one match existing accounts. Unsure how to proceed.',
      undefined
    );
  }

  // This is a situation where they do have a verified email address, but none
  // match, so let's see if the user has set things up in order to be able to
  // create a new account
  if (matchingEmails.length === 0) {
    // Does the session include an invite?
    const possibleInvite = sessionData?.invite;

    // If no invite - cannot register new account
    if (!possibleInvite) {
      return done(
        'You cannot register a new account as no invite code was provided.',
        undefined
      );
    }

    // How do we create this user
    const newUser = async () => {
      // So the invite is valid we should now start to setup the user
      const [newDbUser, errorMsg] = await createUser({
        email: verifiedEmails[0],
        username: verifiedEmails[0],
        name: profile.displayName,
      });

      // something went wrong here
      if (!newDbUser) {
        throw Error(
          `Internal system error: unable to create new user! Error: ${errorMsg ?? 'not provided.'}`
        );
      }

      // add the google profile info
      newDbUser.profiles['google'] = profile;

      // add the other emails to the user emails array if necessary
      addEmails({user: newDbUser, emails: verifiedEmails});

      return newDbUser;
    };

    // Now handle invite auth
    let newDbUser: PeopleDBDocument;
    try {
      newDbUser = await handleAuthInvite({
        dbUser: undefined,
        inviteCode: possibleInvite,
        createUser: newUser,
      });
    } catch (e) {
      return done(
        `Invite was present, but seems incorrect, or other error occurred. Error: ${e}`,
        undefined
      );
    }

    // We have now consumed the invite and updated the user - save
    await saveCouchUser(newDbUser);

    // Upgrade this user
    const user = await upgradeCouchUserToExpressUser({dbUser: newDbUser});

    // Return the freshly minted user :)
    return done(null, user);
  }

  // We have precisely one matching email address, let's ensure that this
  // account has the linked google profile, then return it (We can safely assert
  // non-null here due to our previous filtering)
  const matchedSingleUser = userLookups[matchingEmails[0]]!;

  // Do we need to save - be performance conscious here
  let requiresSave = false;

  // Firstly - ensure they have the google profile linked
  if (!('google' in matchedSingleUser.profiles)) {
    matchedSingleUser.profiles['google'] = profile;
    requiresSave = true;
  }

  // Now - we could still have an invite code here (since we may have accessed
  // this after clicking "already have an account")
  if (sessionData?.invite) {
    requiresSave = true;
    // handle invite on existing user
    await handleAuthInvite({
      dbUser: matchedSingleUser,
      inviteCode: sessionData.invite,
    });
  }

  // Save user (if necessary)
  if (requiresSave) {
    await saveCouchUser(matchedSingleUser);
  }

  // upgrade user
  return done(
    null,
    await upgradeCouchUserToExpressUser({dbUser: matchedSingleUser})
  );
}

export const getGoogleOAuthStrategy: StrategyGeneratorFunction = ({
  loginCallbackUrl: loginCallback,
}) => {
  if (GOOGLE_CLIENT_ID === '') {
    throw Error('GOOGLE_CLIENT_ID must be set to use Google');
  }
  if (GOOGLE_CLIENT_SECRET === '') {
    throw Error('GOOGLE_CLIENT_SECRET must be set to use Google');
  }

  // This strategy handles both login and registration cases with the same
  // verify function
  const strategy = new Strategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: loginCallback,
      passReqToCallback: true,
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
      state: true,
    },
    oauthVerify
  );

  return strategy;
};
