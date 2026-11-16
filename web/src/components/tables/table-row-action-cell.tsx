// SPDX-License-Identifier: Apache-2.0
import type {ReactNode} from 'react';

/** Stops a row click when the user hits a Link/Unlink (or similar) control. */
export const TABLE_ROW_ACTION_BUTTON_CLASS = 'w-full px-2';

/** Fixed-width action cell that does not trigger the parent row click. */
export function TableRowActionCell({children}: {children: ReactNode}) {
  return (
    <span
      className="flex w-16"
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      {children}
    </span>
  );
}
