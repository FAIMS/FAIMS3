import {TokenContents} from '@faims3/data-model';
import crypto from 'crypto';
import {CONDUCTOR_INSTANCE_NAME} from './buildconfig';

/**
 * Slugify a string, replacing special characters with less special ones
 * @param str input string
 * @returns url safe version of the string
 * https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
export const slugify = (str: string) => {
  str = str.trim();
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};

/**
 * Generate a TokenContents object for use in API code
 *
 * Not to be used for real authentication use cases.
 *
 * @param user A user object
 * @returns a token that can be used where authentication is required
 */
export const mockTokenContentsForUser = (user: Express.User): TokenContents => {
  return {
    globalRoles: user.globalRoles,
    resourceRoles: user.resourceRoles,
    server: slugify(CONDUCTOR_INSTANCE_NAME),
    username: user.user_id,
    // Five minutes from now
    exp: Date.now() + 1000 * 60 * 5,
  };
};

/**
 * Generates a random alphanumeric sequence for use in identifiers
 * @param length The length of the sequence to generate (default: 4)
 * @returns A random alphanumeric string
 */
export const generateRandomString = (length = 4): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
};

// Configuration for verification codes
export const VERIFICATION_CODE_LENGTH = 10;
export const VERIFICATION_CODE_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Creates a cryptographic hash of a verification/challenge code.
 *
 * @param code The code to hash
 * @returns An object containing the hash and salt
 */
export function hashChallengeCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generates a cryptographically secure random verification code.
 *
 * @param length The length of the code to generate (default: VERIFICATION_CODE_LENGTH)
 * @param charset The characters to use in the code (default: VERIFICATION_CODE_CHARSET)
 * @returns {string} A random verification code of the specified length
 */
export function generateVerificationCode(
  length: number = VERIFICATION_CODE_LENGTH,
  charset: string = VERIFICATION_CODE_CHARSET
): string {
  if (length <= 0) {
    throw new Error('Code length must be greater than 0');
  }
  if (charset.length === 0) {
    throw new Error('Charset must not be empty');
  }

  // Calculate how many random bytes we need
  // We need enough bytes to have sufficient entropy for our charset
  const randomBytes = crypto.randomBytes(length * 2);
  let result = '';

  for (let i = 0; i < length; i++) {
    // Use two bytes for each character to ensure uniform distribution
    const randomValue = (randomBytes[i * 2] << 8) + randomBytes[i * 2 + 1];
    result += charset[randomValue % charset.length];
  }

  return result;
}
