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
 *   This module configures authentication using SAML 2.0 identity providers
 *   (e.g., myGovID/FAS, ADFS, etc.)
 */

import {Profile, Strategy, VerifyWithRequest} from 'passport-saml';

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
import {SAMLAuthProviderConfig} from './strategyTypes';

/**
 * Extracts email from SAML profile/assertion
 * Different IdPs use different attribute names for email
 */
const extractEmailFromSamlProfile = (profile: Profile): string | null => {
  return (
    (profile.email as string) ||
    (profile.mail as string) ||
    (profile[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    ] as string) ||
    profile.nameID ||
    null
  );
};

/**
 * Extracts display name from SAML profile/assertion
 * Different IdPs use different attribute names for name fields
 */
const extractNameFromSamlProfile = (profile: Profile): string => {
  const name =
    (profile.name as string) ||
    (profile[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ] as string);

  if (name) return name;

  const givenName =
    (profile.givenName as string) ||
    (profile[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'
    ] as string) ||
    '';

  const familyName =
    (profile.familyName as string) ||
    (profile.surname as string) ||
    (profile[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
    ] as string) ||
    '';

  return `${givenName} ${familyName}`.trim() || 'Unknown';
};

/**
 * The verify function receives the verified profile information from a SAML
 * Authentication challenge.
 *
 * This function will pass through the user information if available, or null if
 * not available. It will also update an existing matched user with this profile
 * if matching by email.
 *
 * @param req - The Express request object containing session information
 * @param profile - User profile information from the SAML assertion
 * @param done - Callback function to signal authentication success/failure
 *
 * @returns This function does not return a value but calls the done callback
 * with either (error, null) in case of failure or (null, user) in case of
 * success
 */
const generateSamlVerifyFunction = ({
  strategyId,
  displayName,
}: {
  strategyId: string;
  displayName: string;
}): VerifyWithRequest => {
  return async (
    req: Express.Request,
    profile: Profile | null | undefined,
    done: (error: any, user?: any, info?: any) => void
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

    // Ensure we have a profile
    if (!profile) {
      return done(
        new Error(
          `No profile returned from ${displayName} SAML provider. Authentication failed.`
        ),
        undefined
      );
    }

    // Extract email from SAML assertion - SAML typically provides a single email
    const email = extractEmailFromSamlProfile(profile);

    if (!email) {
      return done(
        new Error(
          `The ${displayName} user does not have an email address in the SAML assertion, and therefore cannot be logged in.`
        ),
        undefined
      );
    }

    // SAML typically provides a single email, but we'll use an array for consistency
    const profileEmails = [email];

    // Look up existing user by email
    const userLookups: {[email: string]: ExistingPeopleDBDocument | null} = {};

    for (const targetEmail of profileEmails) {
      userLookups[targetEmail] =
        await getCouchUserFromEmailOrUserId(targetEmail);
    }

    const matchingEmails = Object.entries(userLookups)
      .filter(([, potentialUser]) => !!potentialUser)
      .map(([email]) => email);

    // create a list of unique matched accounts
    const matchingAccounts: ExistingPeopleDBDocument[] = [];
    for (const matchedEmail of matchingEmails) {
      const user = userLookups[matchedEmail]!;
      if (!matchingAccounts.map(acc => acc._id).includes(user._id)) {
        matchingAccounts.push(user);
      }
    }

    // Multiple matching accounts is an error state
    if (matchingAccounts.length > 1) {
      return done(
        new Error(
          `The ${displayName} profile matched more than one existing account. Unsure how to proceed.`
        ),
        undefined
      );
    }

    if (action === 'login') {
      // LOGIN
      // =====

      if (matchingAccounts.length === 0) {
        return done(
          new Error(
            `This ${displayName} user account does not exist in our system. Instead, you should register for a new account by using an invite code shared with you.`
          ),
          undefined
        );
      }

      const matchedSingleUser = matchingAccounts[0];

      // Ensure they have the SAML profile linked
      if (!(strategyId in matchedSingleUser.profiles)) {
        matchedSingleUser.profiles[strategyId] = profile;
        await saveCouchUser(matchedSingleUser);
      }

      // upgrade user and return login success
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

      if (matchingAccounts.length === 0) {
        // Create new user
        const displayNameFromProfile = extractNameFromSamlProfile(profile);

        const [newDbUser] = await createUser({
          email: profileEmails[0],
          username: profileEmails[0],
          name: displayNameFromProfile,
          verified: true,
        });

        if (!newDbUser) {
          throw Error(
            'Internal system error: unable to create new user! Contact a system administrator.'
          );
        }

        // add the SAML profile info
        newDbUser.profiles[strategyId] = profile;

        // add emails
        addEmails({
          user: newDbUser,
          emails: profileEmails.map(vEmail => {
            return {email: vEmail, verified: true} satisfies VerifiableEmail;
          }),
        });

        await saveCouchUser(newDbUser);

        return done(
          null,
          await upgradeCouchUserToExpressUser({dbUser: newDbUser})
        );
      }

      // User exists - log them in and link the profile
      const matchedSingleUser = matchingAccounts[0];

      if (!(strategyId in matchedSingleUser.profiles)) {
        matchedSingleUser.profiles[strategyId] = profile;
      }

      addEmails({
        user: matchedSingleUser,
        emails: profileEmails.map(vEmail => {
          return {email: vEmail, verified: true} satisfies VerifiableEmail;
        }),
      });

      await saveCouchUser(matchedSingleUser);

      return done(
        null,
        await upgradeCouchUserToExpressUser({dbUser: matchedSingleUser})
      );
    }
  };
};

/**
 * Generator function for SAML passport strategy
 * Given the configuration for a SAML provider, return a configured passport strategy
 */
export const samlStrategyGenerator = (
  options: SAMLAuthProviderConfig
): Strategy => {
  const strategy = new Strategy(
    {
      // Required
      entryPoint: options.entryPoint,
      issuer: options.issuer,
      // The IdP's public cert (for verifying IdP signatures)
      cert: options.idpPublicKey,
      // Callback URL
      callbackUrl:
        options.callbackUrl ||
        CONDUCTOR_PUBLIC_URL + providerAuthReturnUrl(options.id),
      path: options.path,
      // SP signing/decryption keys
      privateKey: options.privateKey,
      decryptionPvk: options.enableDecryptionPvk
        ? options.privateKey
        : undefined,
      // Signature configuration
      signatureAlgorithm: options.signatureAlgorithm,
      digestAlgorithm: options.digestAlgorithm,
      wantAssertionsSigned: options.wantAssertionsSigned,
      // SAML behavior
      identifierFormat: options.identifierFormat,
      authnContext: options.authnContext
        ? Array.isArray(options.authnContext)
          ? options.authnContext
          : [options.authnContext]
        : undefined,
      disableRequestedAuthnContext: options.disableRequestedAuthnContext,
      forceAuthn: options.forceAuthn,
      // Validation
      acceptedClockSkewMs: options.acceptedClockSkewMs,
      maxAssertionAgeMs: options.maxAssertionAgeMs,
      validateInResponseTo: options.validateInResponseTo,
      requestIdExpirationPeriodMs: options.requestIdExpirationPeriodMs,
      // Logout
      logoutUrl: options.logoutUrl,
      logoutCallbackUrl: options.logoutCallbackUrl,
      // IdP validation
      idpIssuer: options.idpIssuer,
      audience: options.audience,
      // Pass request to callback for session access
      passReqToCallback: true,
    },
    generateSamlVerifyFunction({
      strategyId: options.id,
      displayName: options.displayName,
    })
  );

  return strategy;
};
