import {TokenContents} from '../datamodel/core';

export function tokenExists(token: null | undefined | TokenContents) {
  return token !== null && token !== undefined;
}
