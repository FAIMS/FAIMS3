/**
 * @file Condition AST types shared by reducers, the condition builder UI, and domain helpers.
 */

// AND/OR operator
export type ConditionBooleanOperator = 'and' | 'or';

export type ConditionRuleOperator =
  | 'equal'
  | 'not-equal'
  | 'greater'
  | 'greater-equal'
  | 'less'
  | 'less-equal'
  | 'regex'
  | 'string-contains'
  | 'string-does-not-contain'
  | 'contains'
  | 'does-not-contain'
  | 'contains-regex'
  | 'does-not-contain-regex'
  | 'contains-one-of'
  | 'does-not-contain-any-of'
  | 'contains-all-of'
  | 'does-not-contain-all-of';

/** UI labels for condition operators (keys match persisted `operator` strings). */
export const allOperators = new Map<ConditionRuleOperator, string>([
  ['equal', 'Equal to'],
  ['not-equal', 'Not equal to'],
  ['greater', 'Greater than'],
  ['greater-equal', 'Greater than or equal'],
  ['less', 'Less than'],
  ['less-equal', 'Less than or equal'],
  ['regex', 'Matches regular expression'],
  ['string-contains', 'String contains'],
  ['string-does-not-contain', 'String does not contain'],
  ['contains', 'List contains this value'],
  ['does-not-contain', 'List does not contain'],
  ['contains-regex', 'List contains a value matching the regular expression'],
  [
    'does-not-contain-regex',
    'List does not contain any value matching the regular expression',
  ],
  ['contains-one-of', 'List contains one of these values'],
  ['does-not-contain-any-of', 'List does not contain any of these values'],
  ['contains-all-of', 'List contains all of these values'],
  ['does-not-contain-all-of', 'List does not contain all of these values'],
]);

export type OperatorInfo = {description: string; example?: string};

/** Additional UI details for condition operators. */
export const operatorDetails: Record<ConditionRuleOperator, OperatorInfo> = {
  equal: {
    description:
      'The field value must be exactly the same as the value you enter.',
  },
  'not-equal': {
    description: 'The field value must be different from the value you enter.',
  },
  greater: {
    description: 'The field value must be greater than the value you enter.',
  },
  'greater-equal': {
    description:
      'The field value must be greater than or equal to the value you enter.',
  },
  less: {
    description: 'The field value must be less than the value you enter.',
  },
  'less-equal': {
    description:
      'The field value must be less than or equal to the value you enter.',
  },
  regex: {
    description: 'The field value must match a regular expression pattern.',
  },
  'string-contains': {
    description: 'The field value must contain the text you enter.',
  },
  'string-does-not-contain': {
    description: 'The field value must not contain the text you enter.',
  },
  contains: {
    description: 'The list field must contain the selected value.',
  },
  'does-not-contain': {
    description: 'The list field must not contain the selected value.',
  },
  'contains-regex': {
    description:
      'At least one value in the list must match the regular expression.',
  },
  'does-not-contain-regex': {
    description: 'No value in the list can match the regular expression.',
  },
  'contains-one-of': {
    description: 'The list must contain at least one of the selected values.',
  },
  'does-not-contain-any-of': {
    description: 'The list must not contain any of the selected values.',
  },
  'contains-all-of': {
    description: 'The list must contain all selected values.',
  },
  'does-not-contain-all-of': {
    description:
      'The list must not contain all selected values at the same time.',
  },
};

///
/// types for JSON consition data
///

// A single rule condition.
export type RuleCondition = {
  operator: ConditionRuleOperator;
  field: string;
  value: unknown;
};

// A boolean condition group.
export type GroupCondition = {
  operator: ConditionBooleanOperator;
  conditions?: ConditionType[];
};

// Saved visibility / branching condition.
// A condition can be either a single rule comparison or a nested AND/OR group.
export type ConditionType = RuleCondition | GroupCondition;

///
/// types for UI node / tree shape components
///

// Editor representation of a single rule condition.
export type ConditionRuleNode = RuleCondition & {
  editorId: string;
  type: 'rule';
};

// Editor representation of a condition group.
export type ConditionGroupNode = {
  editorId: string;
  type: 'group';
  operator: ConditionBooleanOperator;
  children: ConditionEditorNode[];
};

// Any node that can appear in the editor tree.
export type ConditionEditorNode = ConditionRuleNode | ConditionGroupNode;

// Option shape used when building conditions against choice fields such as select, radio, and multi-select fields.
export type SelectableConditionOption = {
  value: string;
  label: string;
  RadioProps?: unknown;
};

/**
 * Actions used by condition editor components to update the editor tree.
 *
 * These actions operate on editor node IDs, not persisted field IDs. This is
 * important because the same field can be used in multiple condition rows.
 */
export type ConditionEditorActions = {
  // rule
  /** Updates part of an existing rule node. */
  updateRule: (id: string, patch: Partial<RuleCondition>) => void;
  /** Adds a new empty rule to the given group. */
  addRule: (groupId: string) => void;
  // oprator
  /** Updates the root group's AND/OR operator. */
  updateRootOperator: (operator: ConditionBooleanOperator) => void;
  /** Updates the AND/OR operator for a specific group. */
  updateGroupOperator: (
    groupId: string,
    operator: ConditionBooleanOperator
  ) => void;
  // node
  /** Deletes a rule or group node from the editor tree. */
  deleteNode: (id: string) => void;
  /** Moves a rule or group node into a target group at the given index. */
  moveNode: (id: string, targetGroupId: string, targetIndex: number) => void;
  // group
  /** Moves a rule or group into a new group with the target rule. */
  groupNodeWithRule: (
    id: string,
    targetRuleId: string,
    operator?: ConditionBooleanOperator
  ) => void;
  /** Wraps a rule in a new group. */
  wrapRuleInGroup: (id: string, operator?: ConditionBooleanOperator) => void;
  /** Removes a group and moves its children up into the parent group. */
  ungroup: (groupId: string) => void;
};
