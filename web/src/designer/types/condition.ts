/**
 * @file Condition AST types shared by reducers, the condition builder UI, and domain helpers.
 */

/** Visibility / branching condition: leaf comparison or nested AND/OR group. */
export type ConditionType = {
  operator: string;
  field?: string;
  value?: unknown;
  conditions?: ConditionType[];
};

/** Props for condition editor components (`ConditionControl`, modal, etc.). */
export type ConditionProps = {
  onChange?: (v: ConditionType | null) => void;
  initial?: ConditionType | null;
  /** When set, restricts which fields can be chosen (e.g. same-section rules). */
  field?: string;
  view?: string;
};

/** Select / radio option shape used when building conditions against choice fields. */
export type SelectableConditionOption = {
  value: string;
  label: string;
  RadioProps?: unknown;
};
