/*
 * Autoincrementing types
 */
export interface LocalAutoIncrementRange {
  start: number;
  stop: number;
  fully_used: boolean;
  using: boolean;
}

export interface LocalAutoIncrementState {
  _id: string;
  _rev?: string;
  last_used_id: number | null;
  ranges: LocalAutoIncrementRange[];
}

export interface AutoIncrementReference {
  form_id: string;
  field_id: string;
  label?: string;
}

export interface UserFriendlyAutoincrementStatus {
  label: string;
  last_used: number | null;
  end: number | null;
}
