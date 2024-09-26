import {Capacitor} from '@capacitor/core';
import {TokenContents} from '@faims3/data-model';

function tokenExists(token: null | undefined | TokenContents) {
  return token !== null && token !== undefined;
}

function tokenValid(token: null | undefined | TokenContents) {
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
  return tokenExists(token) && tokenValid(token);
}
/**
 * Are we running on the web or mobile?
 * @returns true if we're running in a web browser, false if in an app
 */

export function isWeb() {
  return Capacitor.getPlatform() === 'web';
}
