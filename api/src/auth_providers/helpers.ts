import {ExistingPeopleDBDocument, PeopleDBDocument} from '@faims3/data-model';
import {getInvite, isInviteValid, consumeInvite} from '../couchdb/invites';
import {randomBytes, pbkdf2Sync} from 'crypto';
import {createUser, saveCouchUser} from '../couchdb/users';

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
export const registerLocalUser = async (
  username: string,
  email: string,
  name: string,
  password: string
): Promise<[PeopleDBDocument | null, string]> => {
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
