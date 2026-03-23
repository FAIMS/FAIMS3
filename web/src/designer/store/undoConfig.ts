import {includeAction} from 'redux-undo';

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
  'ui-specification/viewSetPublishButtonBehaviourUpdated',
  'ui-specification/viewSetLayoutUpdated',
  'ui-specification/viewSetSummaryFieldsUpdated',
  'ui-specification/viewSetHridUpdated',
] as const;

export const uiSpecUndoConfig = {
  limit: 10,
  filter: includeAction(UNDOABLE_UI_SPEC_ACTIONS),
  clearHistoryType: 'CLEAR_HISTORY',
  initTypes: [],
};
