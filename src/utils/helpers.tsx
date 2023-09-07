import {TokenContents} from 'faims3-datamodel';

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
