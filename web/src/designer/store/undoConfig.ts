// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Which UI-spec action types are recorded by `redux-undo` (stack limit 10).
 */

import {includeAction} from 'redux-undo';

/** Action type strings that push a snapshot onto the undo stack (limit 10). */
export const UNDOABLE_UI_SPEC_ACTIONS = [
  // Field actions
  'ui-specification/fieldAdded',
  'ui-specification/fieldDeleted',
  'ui-specification/fieldUpdated',
  'ui-specification/fieldDuplicated',
  'ui-specification/fieldMoved',
  'ui-specification/fieldConditionChanged',
  'ui-specification/fieldMovedToSection',
  'ui-specification/fieldRenamed',
  'ui-specification/toggleFieldProtection',
  'ui-specification/toggleFieldHidden',

  // Section actions
  'ui-specification/sectionAdded',
  'ui-specification/sectionDeleted',
  'ui-specification/sectionRenamed',
  'ui-specification/sectionDuplicated',
  'ui-specification/sectionMovedToForm',
  'ui-specification/sectionMoved',
  'ui-specification/sectionConditionChanged',

  // ViewSet actions
  'ui-specification/viewSetAdded',
  'ui-specification/viewSetDeleted',
  'ui-specification/viewSetRenamed',
  'ui-specification/viewSetMoved',
  'ui-specification/formVisibilityUpdated',
  'ui-specification/viewSetLayoutUpdated',
  'ui-specification/viewSetSummaryFieldsUpdated',
  'ui-specification/viewSetHridUpdated',
] as const;

/** Passed to `undoable(uiSpecificationReducer.reducer, uiSpecUndoConfig)`. */
export const uiSpecUndoConfig = {
  limit: 10,
  filter: includeAction(UNDOABLE_UI_SPEC_ACTIONS),
  clearHistoryType: 'CLEAR_HISTORY',
  initTypes: [],
};
