// SPDX-License-Identifier: Apache-2.0
import type {ExistingPeopleDBDocument} from './types';

/** True when the account is disabled (soft-off); missing/false means active. */
export function isPeopleUserAccountDisabled(
  user: Pick<ExistingPeopleDBDocument, 'disabled'>
): boolean {
  return user.disabled === true;
}
