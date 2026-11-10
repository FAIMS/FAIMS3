// SPDX-License-Identifier: Apache-2.0
import type {ReactNode} from 'react';

const ACTIONS_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

/**
 * Shared responsive card grid for Control Centre Actions tabs.
 *
 * @param {ReactNode} children - Action cards; hidden cards are omitted so remaining cells pack left.
 * @returns {JSX.Element} The grid wrapper.
 */
export function ActionsGrid({children}: {children: ReactNode}): JSX.Element {
  return <div className={ACTIONS_GRID_CLASS}>{children}</div>;
}
