import {
  AuthContext,
  ExistingPeopleDBDocument,
  PeopleDBDocument,
} from '@faims3/data-model';
import {pbkdf2Sync, randomBytes} from 'crypto';
import {Response} from 'express';
import {ZodError} from 'zod';
import {AuthProvider, REDIRECT_WHITELIST} from '../buildconfig';
import {consumeInvite, getInvite, isInviteValid} from '../couchdb/invites';
import {createUser, saveCouchUser} from '../couchdb/users';
import {AuthAction, CustomRequest} from '../types';
import {generateUserToken} from './keySigning/create';
import {AUTH_PROVIDER_DETAILS} from './strategies/applyStrategies';

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
): string {
  try {
    // If redirect is undefined, null, or empty string, return default
    if (!redirect) {
      return '/';
    }

    // First check if we can parse the URL
    if (!URL.canParse(redirect)) {
      return '/';
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
          return redirect;
        }
      } catch (error) {
        // Skip invalid whitelist entries
        console.error(`Invalid whitelist entry: ${whitelistedDomain}`, error);
        continue;
      }
    }

    // No match found, return the default redirect
    return '/';
  } catch (error) {
    // Any parsing errors or other issues, return the default redirect
    console.error('Error validating redirect URL:', error);
    return '/';
  }
}

/**
 * Generate a redirect response with a token and refresh token for a logged in
 * user
 *
 * @param res Express response
 * @param user Express user
 * @param redirect URL to redirect to
 * @returns a redirect response with a suitable token
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
  // there is a case where the redirect url will already
  // have a token (register >> login >>  register)
  if (redirect.indexOf('?token=') >= 0) {
    return res.redirect(redirect);
  }

  // Generate a token (include refresh)
  const token = await generateUserToken(user, true);

  // Append the token to the redirect URL
  const redirectUrlWithToken = `${redirect}?token=${token.token}&refreshToken=${token.refreshToken}`;

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
  handlers: AuthProvider[];
  redirectUrl: string;
  inviteId?: string;
  action: AuthAction;
}) {
  const providers = [];
  for (const handler of handlers) {
    const details = AUTH_PROVIDER_DETAILS[handler];
    providers.push({
      id: details.id,
      name: details.displayName,
      targetUrl: `/auth/${details.id}${buildQueryString({
        values: {
          redirect: redirectUrl,
          inviteId,
          action,
        } satisfies AuthContext,
      })}`,
    });
  }
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
