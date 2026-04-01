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
import {SignedXml} from 'xml-crypto';
import {CONDUCTOR_PUBLIC_URL} from '../../buildconfig';
import {providerAuthReturnUrl} from '../authRoutes';
import {ssoVerify} from '../helpers';
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
    // Ensure we have a profile
    if (!profile) {
      return done(
        new Error(
          `No profile returned from ${displayName} SAML provider. Authentication failed.`
        ),
        undefined
      );
    }

    const email = extractEmailFromSamlProfile(profile);

    // Extract email from SAML assertion - SAML typically provides a single email

    if (!email) {
      return done(
        new Error(
          `The ${displayName} user does not have an email address in the SAML assertion, and therefore cannot be logged in.`
        ),
        undefined
      );
    }

    return ssoVerify({
      req,
      strategyId,
      strategyName: displayName,
      profile,
      emails: [email],
      userDisplayName: extractNameFromSamlProfile,
      done,
    });
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

/**
 * Signs SAML metadata XML using the SP's private key.
 * The public certificate must be supplied so xml-crypto emits KeyInfo with X509Data /
 * X509Certificate inside the Signature element (required e.g. by VANguard).
 *
 * @param metadataXml - The unsigned metadata XML string
 * @param privateKey - PEM-encoded private key
 * @param publicCert - PEM-encoded service provider certificate (same keypair as privateKey)
 * @returns Signed metadata XML string
 */
export const signSamlMetadata = (
  metadataXml: string,
  privateKey: string,
  publicCert: string
): string => {
  const sig = new SignedXml();

  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

  sig.addReference({
    xpath: "/*[local-name(.)='EntityDescriptor']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });

  sig.privateKey = privateKey;
  sig.publicCert = publicCert;

  sig.computeSignature(metadataXml, {
    location: {
      reference: "/*[local-name(.)='EntityDescriptor']",
      action: 'prepend',
    },
  });

  return sig.getSignedXml();
};
