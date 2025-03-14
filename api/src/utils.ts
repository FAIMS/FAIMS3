import {TokenContents} from '@faims3/data-model';
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
    roles: user.roles,
    server: slugify(CONDUCTOR_INSTANCE_NAME),
    username: user.user_id,
    // Five minutes from now
    exp: Date.now() + 1000 * 60 * 5,
  };
};
