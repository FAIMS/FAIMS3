export type ConditionType = {
  operator: string;
  field?: string;
  value?: unknown;
  conditions?: ConditionType[];
};

export type ConditionProps = {
  onChange?: (v: ConditionType | null) => void;
  initial?: ConditionType | null;
  field?: string;
  view?: string;
};

export type SelectableConditionOption = {
  value: string;
  label: string;
  RadioProps?: unknown;
};
