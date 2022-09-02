import {TokenContents} from '../datamodel/core';

export function tokenExists(token: null | undefined | TokenContents) {
  return token !== null && token !== undefined;
}

export function tokenValid(token: null | undefined | TokenContents) {
  /**
   * Check for expiry AND validity
   */
  // TODO
  return true;
}

export function checkToken(token: null | undefined | TokenContents) {
  /**
   * Check if the token exists, and whether it's valid
   */
  return tokenExists(token) && tokenValid(token);
}
