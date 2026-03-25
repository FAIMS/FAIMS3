import {
  addEmails,
  addGlobalRole,
  addTeamRole,
  AuthContext,
  ExistingPeopleDBDocument,
  PeopleDBDocument,
  Role,
  TeamsDBFields,
  VerifiableEmail,
} from '@faims3/data-model';
import {pbkdf2Sync, randomBytes} from 'crypto';
import {Response} from 'express';
import {ZodError} from 'zod';
import {
  CONDUCTOR_SERVER_ID,
  PROVISION_SSO_USERS_POLICY,
  REDIRECT_WHITELIST,
} from '../buildconfig';
import {consumeInvite, getInvite, isInviteValid} from '../couchdb/invites';
import {createNewRefreshToken} from '../couchdb/refreshTokens';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../couchdb/users';
import {AuthAction, CustomRequest, CustomSessionData} from '../types';
import {RegisteredAuthProviders} from './strategies/applyStrategies';
import {
  validatePasswordStrength,
  getPasswordErrorMessage,
} from './passwordStrength';
import {upgradeCouchUserToExpressUser} from './keySigning/create';
import {createTeamDocument} from '../couchdb/teams';

/**
 * Handles Zod validation errors and flashes them back to the user
 *
 * @param error The ZodError from Zod validation
 * @param req Express request object
 * @param res Express response object
 * @param formData The form data to flash back to the form
 * @param redirectUrl The URL to redirect to on error
 * @returns boolean indicating if the error was handled
 */
export const handleZodErrors = ({
  error,
  req,
  res,
  formData,
  redirect,
}: {
  error: unknown;
  req: Request;
  res: Response;
  formData: Record<string, string>;
  redirect: string;
}): boolean => {
  if (error instanceof ZodError) {
    // Convert ZodError format to match express-validator's errors.mapped()
    const formattedErrors: Record<string, {msg: string}> = {};

    error.errors.forEach(err => {
      // Get the last part of the path as the field name
      const field = err.path[err.path.length - 1] as string;
      formattedErrors[field] = {msg: err.message};
    });

    (req as unknown as CustomRequest).flash('error', formattedErrors);

    // Flash back the form data to repopulate the form
    Object.entries(formData).forEach(([key, value]) => {
      if (value) {
        (req as unknown as CustomRequest).flash(key, value);
      }
    });

    // Set response status and redirect
    res.status(400);
    res.redirect(redirect);

    return true;
  }

  return false;
};

/**
 * Check that a redirect URL is one that we allow based on our whitelist
 * configuration. Verifies that the redirect URL's origin (protocol + hostname +
 * port) matches one of the whitelisted domains.
 *
 * This is a security-critical function that prevents open redirect
 * vulnerabilities.
 *
 * @param redirect URL to redirect to
 * @returns a valid URL to redirect to that matches our whitelist, default to
 * '/' if invalid
 */
export function validateRedirect(
  redirect: string,
  whitelist: string[] = REDIRECT_WHITELIST
): {valid: boolean; redirect: string} {
  const fail = () => ({valid: false, redirect: '/'});
  try {
    // If redirect is undefined, null, or empty string, return default
    if (!redirect) {
      return fail();
    }

    // First check if we can parse the URL
    if (!URL.canParse(redirect)) {
      return fail();
    }

    const redirectUrl = new URL(redirect);

    // Absolute URLs must match one of our whitelisted domains
    for (const whitelistedDomain of whitelist) {
      try {
        const whitelistedUrl = new URL(whitelistedDomain);

        if (redirectUrl.protocol !== whitelistedUrl.protocol) {
          // Protocols not matching! Abort!
          continue;
        }

        if (redirectUrl.port !== whitelistedUrl.port) {
          // Ports not matching! Abort!
          continue;
        }

        // Final check - slightly redundant
        if (redirectUrl.origin === whitelistedUrl.origin) {
          // Compare origins (protocol + hostname + port)
          return {valid: true, redirect};
        }
      } catch (error) {
        // Skip invalid whitelist entries
        console.error(`Invalid whitelist entry: ${whitelistedDomain}`, error);
        continue;
      }
    }

    // No match found, return the default redirect
    return fail();
  } catch (error) {
    // Any parsing errors or other issues, return the default redirect
    console.error('Error validating redirect URL:', error);
    return fail();
  }
}

/**
 * Generate a redirect response with an exchange token granting access to a
 * refresh token
 *
 * @param res Express response
 * @param user Express user
 * @param redirect URL to redirect to
 * @returns a redirect response with a suitable exchange token
 */
export const redirectWithToken = async ({
  res,
  user,
  redirect,
}: {
  res: Response;
  user: Express.User;
  redirect: string;
}) => {
  // Generate a refresh token
  const {exchangeToken} = await createNewRefreshToken({userId: user._id});

  // Append the token to the redirect URL with exchange token and server ID
  // (this helps multi server clients know who is redirecting back)
  const redirectUrlWithToken = `${redirect}?exchangeToken=${exchangeToken}&serverId=${CONDUCTOR_SERVER_ID}`;

  // Redirect to the app with the token
  return res.redirect(redirectUrlWithToken);
};

/**
 * Builds a URL query string from an object of key-value pairs.
 *
 * @param values - An object where keys are parameter names and values are parameter values
 * @returns A properly formatted query string starting with '?' if any valid parameters exist, or an empty string if none
 */
export function buildQueryString({
  values,
}: {
  values: {[key: string]: string | undefined | null};
}): string {
  // Filter out null and undefined values
  const validEntries = Object.entries(values).filter(
    ([, value]) => value !== null && value !== undefined
  );

  // If no valid entries, return empty string
  if (validEntries.length === 0) {
    return '';
  }

  // Build query string with URL encoding for both keys and values
  const queryParams = validEntries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join('&');

  // Return the query string with leading question mark
  return `?${queryParams}`;
}

/**
 * Builds render details for providers
 */
export function providersToRenderDetails({
  handlers,
  redirectUrl,
  inviteId = undefined,
  action,
}: {
  handlers: RegisteredAuthProviders | null;
  redirectUrl: string;
  inviteId?: string;
  action: AuthAction;
}) {
  const providers = [];
  for (const id in handlers) {
    providers.push({
      id: id,
      index: handlers[id].config.index ?? 100,
      name: handlers[id].config.displayName,
      helperText: handlers[id].config.helperText,
      targetUrl: `/auth/${id}${buildQueryString({
        values: {redirect: redirectUrl, inviteId, action} satisfies AuthContext,
      })}`,
    });
  }
  // sort providers by the index property
  providers.sort((a, b) => {
    return a.index - b.index;
  });
  return providers;
}

/**
 * Fetches and validates an invite by ID
 * @returns invite if valid/present
 */
export async function lookupAndValidateInvite({
  inviteCode,
}: {
  inviteCode: string;
}) {
  // Try and lookup the invite
  const invite = await getInvite({inviteId: inviteCode});

  // If no invite - cannot register new account
  if (!invite) {
    throw new Error(
      'Invite was present, but seems incorrect. Cannot register new account.'
    );
  }

  // Is the invite valid?
  const {isValid, reason} = isInviteValid({invite});

  if (!isValid) {
    throw new Error(
      `Invite was correct, but is longer valid. Reason: ${reason ?? 'not provided.'}.`
    );
  }

  return invite;
}

/**
 * Handles authentication via invite code, validating the invite and associating
 * it with a user.
 *
 * This function processes an invitation during user authentication. It
 * validates the provided invite code, checks if it's still valid, and
 * associates it with either an existing user or a newly created user. After
 * successful validation, it consumes the invite, which typically grants
 * permissions or roles to the user based on the invitation parameters.
 *
 * The user generation function (if provided) will only be used if the invite
 * appears valid, just in case it has side effects.
 *
 * The resulting user will NOT be saved. Call saveCouchUser()
 *
 * @param dbUser - Optional. An existing user in the database. Either this or
 * createUser must be provided.
 * @param createUser - Optional. A function that creates and returns a new user.
 * Used when dbUser is not provided.
 * @param inviteCode - The invitation code to process and validate
 *
 * @returns The user document (either existing or newly created) with updated
 * permissions
 *
 * @throws {Error} If neither dbUser nor createUser is provided
 * @throws {Error} If the invite code doesn't correspond to a valid invitation
 * @throws {Error} If the invitation exists but is no longer valid (expired,
 * already used, etc.)
 * @throws {Error} If the invitation cannot be consumed or associated with the
 * user
 */
export async function validateAndApplyInviteToUser({
  dbUser,
  inviteCode,
  createUser,
}: {
  dbUser?: PeopleDBDocument;
  createUser?: () => Promise<PeopleDBDocument>;
  inviteCode: string;
}): Promise<PeopleDBDocument> {
  if (!(createUser || dbUser)) {
    throw new Error(
      'Must provide either a way to generate a user, or an existing user, to handle an auth invitation.'
    );
  }

  // Try and lookup the invite
  const invite = await lookupAndValidateInvite({inviteCode});

  let targetDbUser: PeopleDBDocument;

  if (dbUser) {
    targetDbUser = dbUser;
  } else {
    targetDbUser = await createUser!();
  }

  // let's add the permission from the invite as well as the prof
  try {
    await consumeInvite({invite, user: targetDbUser});
  } catch (e) {
    // Failed to consume the invite - do not save the user
    throw new Error(
      `Unable to consume the invite which appears valid. Error: ${e}.`
    );
  }

  return targetDbUser;
}

/**
 * registerLocalUser - create a new user account
 *   either `username` or `email` is required to make an account
 *   no existing account should exist with these credentials
 *
 * @param username - a username, not previously used
 * @param email - an email address, not previously used
 * @param name - user's full name
 * @param password - a password
 * @param roles - a list of user roles
 */
export const registerLocalUser = async ({
  username,
  email,
  name,
  password,
}: {
  username: string;
  email: string;
  name: string;
  password: string;
}): Promise<[PeopleDBDocument | null, string]> => {
  const [user, error] = await createUser({email, username, name});
  if (user) {
    addLocalPasswordForUser(user, password);
  }
  return [user, error];
};

export const addLocalPasswordForUser = async (
  user: PeopleDBDocument | ExistingPeopleDBDocument,
  password: string
) => {
  const salt = randomBytes(64).toString('hex');
  try {
    const hashedPassword = pbkdf2Sync(password, salt, 100000, 64, 'sha256');
    user.profiles['local'] = {
      password: hashedPassword.toString('hex'),
      salt: salt,
    };
    await saveCouchUser(user);
  } catch {
    throw Error('Error hashing password');
  }
};

/**
 * Validates a password and throws an error with helpful feedback if invalid
 *
 * @param password - The password to validate
 * @param userInputs - Array of user-specific inputs (email, name) to check against
 * @throws Error with detailed feedback if password is too weak
 */
export function validatePasswordOrThrow(
  password: string,
  userInputs: string[] = []
): void {
  const result = validatePasswordStrength(password, userInputs);

  if (!result.isValid) {
    throw new Error(getPasswordErrorMessage(result));
  }
}

/**
 * Identify an existing user from a list of email addresses from an SSO user profile
 *
 * @param userEmails - A list of verified email addresses associated with a user's profile
 * @throws Error if there are no verified email addresses, or if multiple accounts match the provided emails
 * @returns The matching user account, or undefined if no match is found
 */
export async function identifyUser(
  userEmails: string[],
  strategyName: string
): Promise<ExistingPeopleDBDocument | undefined> {
  if (userEmails.length === 0) {
    // indicate error since there are no valid email addresses!
    throw new Error(
      `The ${strategyName} user does not have any verified email addresses, and therefore cannot be logged in.`
    );
  }

  // so they have at least one valid email address - let's see if we can find
  // precisely ONE profile that matches
  const userLookups: {[email: string]: ExistingPeopleDBDocument | null} = {};

  for (const targetEmail of userEmails) {
    // Try to get the user based on the target email
    userLookups[targetEmail] = await getCouchUserFromEmailOrUserId(targetEmail);
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
    throw new Error(
      `The ${strategyName} user's profile included more than one email address, of which more than one match existing accounts. Unsure how to proceed.`
    );
  }
  // return either the matching account or undefined if there were no matches
  if (matchingAccounts.length === 0) {
    return undefined;
  } else {
    return matchingAccounts[0];
  }
}

// A type describing the things we expect to see in a generic
// SSO profile for the purposes of our authentication helpers
type GenericProfile = {[key: string]: any};

/**
 * A generic SSO verify function that handles both login and registration
 * flows. Used in OIDC/Google/SAML strategies.
 *
 * @param param0 req - The Express request object containing session information
 * @param param0 strategyId - The identifier for the authentication strategy (e.g., 'google', 'saml')
 * @param param0 strategyName - The display name for the authentication strategy (used in error messages)
 * @param param0 profile - The user profile information returned from the SSO provider
 * @param param0 emails - A list of verified email addresses extracted from the SSO profile
 * @param param0 userDisplayName - A function to extract the display name from the profile for user creation
 * @param param0 done - Callback function to signal authentication success/failure
 * @returns A promise that resolves when the verification process is complete
 */
export async function ssoVerify({
  req,
  strategyId,
  strategyName,
  profile,
  emails,
  userDisplayName,
  done,
}: {
  req: Express.Request;
  strategyId: string;
  strategyName: string;
  profile: GenericProfile; // a profile
  emails: string[]; // a list of verified emails we have pulled out of the profile
  userDisplayName: (profile: GenericProfile) => string; // an optional function to pull a display name out of the profile
  done: (error: any, user?: any, info?: any) => void;
}): Promise<void> {
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

  let matchedSingleUser: ExistingPeopleDBDocument | undefined;
  try {
    matchedSingleUser = await identifyUser(emails, strategyName);
  } catch (e) {
    return done(e as Error, undefined);
  }

  if (action === 'login') {
    // LOGIN
    // =====

    // This is a situation where they do have a verified email address but none
    // match
    if (matchedSingleUser === undefined) {
      // We apply the policy for unknown SSO users which may result in a
      // new user or a rejection depending on the configuration

      try {
        const newDbUser = await applyProvisionPolicy({
          emails,
          profile,
          strategyId,
          userDisplayName,
        });

        // persist the new user
        saveCouchUser(newDbUser);

        // return express user
        return done(
          null,
          await upgradeCouchUserToExpressUser({dbUser: newDbUser})
        );
      } catch (e) {
        // generally here because the policy is 'reject' but catch other errors too
        return done(e as Error, undefined);
      }
    }

    // We have precisely one matching email address, let's ensure that this
    // account has the linked SSO profile, then return it (We can safely assert
    // non-null here due to our previous filtering)
    // const matchedSingleUser = matchingAccounts[0];

    // Firstly - ensure they have the right profile linked
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
    if (matchedSingleUser === undefined) {
      // So the invite is valid we should now start to setup the user

      const newDbUser = await createAndAddNewUser({
        emails,
        profile,
        strategyId,
        userDisplayName,
      });

      saveCouchUser(newDbUser);

      // return express user
      return done(
        null,
        await upgradeCouchUserToExpressUser({dbUser: newDbUser})
      );
    }

    // NOTE: This is the situation where you are trying to 'register' a new
    // account but one already exists with SSO with matching email - we
    // decide here to instead log them in - upgrading the potentially
    // unconnected account

    // We have precisely one matching email address, let's ensure that this
    // account has the linked SSO profile, then return it (We can safely assert
    // non-null here due to our previous filtering)

    // Firstly - ensure they have the SSO profile linked
    if (!(strategyId in matchedSingleUser.profiles)) {
      matchedSingleUser.profiles[strategyId] = profile;
    }

    // add the other emails to the user emails array if necessary
    addEmails({
      user: matchedSingleUser,
      emails: emails.map(vEmail => {
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
}

/**
 * Create a new user from a profile that has come back from an SSO provider,
 * and add the relevant profile
 *
 * @param emails - A list of verified email addresses associated with the user's profile
 * @param profile - The full profile object returned from the SSO provider
 * @param strategyId - The identifier for the authentication strategy (e.g., 'google', 'saml')
 * @param userDisplayName - A function to extract the display name from the profile
 * @returns The newly created user document - need to call saveCouchUser() to persist
 */
async function createAndAddNewUser({
  emails,
  profile,
  strategyId,
  userDisplayName,
}: {
  emails: string[];
  profile: any;
  strategyId: string;
  userDisplayName: (profile: any) => string;
}) {
  const [newDbUser] = await createUser({
    // Use the first email (assumed okay to be primary lookup email)
    email: emails[0],
    username: emails[0],
    name: userDisplayName(profile),
    verified: true,
  });

  // something went wrong here
  if (!newDbUser) {
    throw Error(
      'Internal system error: unable to create new user! Contact a system administrator.'
    );
  }

  // add the profile info
  newDbUser.profiles[strategyId] = profile;

  // add the other emails to the user emails array if necessary
  addEmails({
    user: newDbUser,
    emails: emails.map(vEmail => {
      // Mark as verified!
      return {email: vEmail, verified: true} satisfies VerifiableEmail;
    }),
  });

  return newDbUser;
}

/**
 * Apply the configured provisioning policy for this unknown user
 * Either reject the login (throws an error) or create a new user and add the configured roles
 *
 * @param emails - array of valid emails for this user
 * @param profile - SSO profile
 * @param strategyId - the strategy the user was authenticated with
 * @param userDisplayName - function to generate a display name for the user from the profile
 * @returns a new database user document - need to call saveDbUser to persist
 */
export async function applyProvisionPolicy({
  emails,
  profile,
  strategyId,
  userDisplayName,
}: {
  emails: string[];
  profile: any;
  strategyId: string;
  userDisplayName: (profile: any) => string;
}) {
  // default option is to reject the login, throw an error to indicate this
  if (PROVISION_SSO_USERS_POLICY === 'reject') {
    throw new Error(
      'This account does not exist in our system. Instead, you should register for a new account by using an invite code shared with you.'
    );
  }

  const newDbUser = await createAndAddNewUser({
    emails,
    profile,
    strategyId,
    userDisplayName,
  });

  if (PROVISION_SSO_USERS_POLICY === 'own-team') {
    // Create a new team
    // Give the user the team manager role on the team

    const teamData: TeamsDBFields = {
      name: `Personal: ${newDbUser.name}`,
      description: `Personal team for ${newDbUser.name}.`,
      createdBy: newDbUser._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newTeam = await createTeamDocument(teamData);

    // Add the team manager role for this user
    addTeamRole({
      user: newDbUser,
      teamId: newTeam._id,
      role: Role.TEAM_MANAGER,
    });
  } else if (PROVISION_SSO_USERS_POLICY === 'general-user') {
    // Give the user a general user role
    addGlobalRole({user: newDbUser, role: Role.GENERAL_USER});
  }
  return newDbUser;
}
