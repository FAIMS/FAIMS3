// SPDX-License-Identifier: Apache-2.0

/**
 * @file Which UI-spec action types are recorded by `redux-undo` (stack limit 10).
 */

import {includeAction} from 'redux-undo';

/** Action type strings that push a snapshot onto the undo stack (limit 10). */
export const UNDOABLE_UI_SPEC_ACTIONS = [
  // Field actions
  'uiSpec/fieldAdded',
  'uiSpec/fieldDeleted',
  'uiSpec/fieldUpdated',
  'uiSpec/fieldDuplicated',
  'uiSpec/fieldMoved',
  'uiSpec/fieldReordered',
  'uiSpec/fieldConditionChanged',
  'uiSpec/fieldMovedToSection',
  'uiSpec/fieldRenamed',
  'uiSpec/toggleFieldProtection',
  'uiSpec/toggleFieldHidden',

  // Section actions
  'uiSpec/sectionAdded',
  'uiSpec/sectionDeleted',
  'uiSpec/sectionRenamed',
  'uiSpec/sectionDuplicated',
  'uiSpec/sectionMovedToForm',
  'uiSpec/sectionMoved',
  'uiSpec/sectionConditionChanged',

  // ViewSet actions
  'uiSpec/viewSetAdded',
  'uiSpec/viewSetDeleted',
  'uiSpec/viewSetRenamed',
  'uiSpec/viewSetMoved',
  'uiSpec/formVisibilityUpdated',
  'uiSpec/viewSetLayoutUpdated',
  'uiSpec/viewSetSummaryFieldsUpdated',
  'uiSpec/viewSetHridUpdated',
  'uiSpec/viewSetDisplayInOverviewMapUpdated',
] as const;

/** Passed to `undoable(uiSpecificationReducer.reducer, uiSpecUndoConfig)`. */
export const uiSpecUndoConfig = {
  limit: 10,
  filter: includeAction([...UNDOABLE_UI_SPEC_ACTIONS]),
  clearHistoryType: 'CLEAR_HISTORY',
  initTypes: [],
};
