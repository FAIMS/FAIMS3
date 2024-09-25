import {TokenContents} from '@faims3/data-model';

export function tokenExists(token: null | undefined | TokenContents) {
  return token !== null && token !== undefined;
}

export function tokenValid(token: null | undefined | TokenContents) {
  /**
   * Check for expiry AND validity
   */
  // TODO

  // username is a valid user
  // roles match those stored in user record
  return token && token.username && token.roles;
}

export function checkToken(token: null | undefined | TokenContents) {
  /**
   * Check if the token exists, and whether it's valid
   */
  console.log('checkToken', token);
  return tokenExists(token) && tokenValid(token);
}

/**
 * A helper function to create multi-key react-query query keys
 * @param keys The keys to join together
 * @returns A single string joined
 */
export function buildQueryKey(keys: string[]): string {
  return keys.join(',');
}

/**
 * Input parameter checker to ensure all values are defined
 * @param vals Values to check
 * @returns Returns true iff no values are undefined or null
 */
export function checkAllRequired(vals: any[]): boolean {
  return !vals.some(v => v === undefined || v === null);
}
