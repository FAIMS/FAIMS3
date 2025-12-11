/**
 * Reference to a specific auto-incrementer field within a form
 */
export type AutoIncrementFieldRef = {
  formId: string;
  fieldId: string;
  numDigits: number;
};

/**
 * A configured range for allocating sequential IDs
 */
export type AutoIncrementRange = {
  start: number;
  stop: number;
  fullyUsed: boolean;
  using: boolean;
};

/**
 * User-friendly status for display purposes
 */
export type AutoIncrementStatus = {
  label: string;
  lastUsed: number | null;
  /** End of current active range, or null if no range active */
  currentRangeEnd: number | null;
  /** Total remaining IDs across all non-exhausted ranges */
  remaining: number | null;
};

/**
 * Stateful interface for managing a single auto-incrementer.
 * Project context is pre-bound by the client wrapper.
 */
export type AutoIncrementer = {
  /** Get the next value, or undefined if all ranges exhausted */
  getNextValue: () => Promise<number | undefined>;

  /** Get the next value formatted with leading zeros */
  getNextValueFormatted: (numDigits: number) => Promise<string | undefined>;

  /** Get current ranges configuration */
  getRanges: () => Promise<AutoIncrementRange[]>;

  /** Add a new range */
  addRange: (start: number, stop: number) => Promise<void>;

  /** Remove a range by index (fails if range is in use) */
  removeRange: (index: number) => Promise<void>;

  /** Update an existing range */
  updateRange: (index: number, range: AutoIncrementRange) => Promise<void>;

  /** Manually set the last used ID (must be within a defined range) */
  setLastUsed: (value: number) => Promise<void>;

  /** Get current status for UI display */
  getStatus: (label: string) => Promise<AutoIncrementStatus>;

  /** Check if any values are available without consuming one */
  hasAvailableValues: () => Promise<boolean>;
};

/**
 * Factory function type - client wrapper provides project context,
 * returns a function that creates incrementers for specific fields
 */
export type CreateAutoIncrementer = (
  ref: AutoIncrementFieldRef
) => AutoIncrementer;

/**
 * Service interface for project-wide auto-increment operations
 */
export type AutoIncrementService = {
  /** Create an incrementer for a specific field */
  getIncrementer: CreateAutoIncrementer;

  /** Get all auto-increment field references from the UI spec */
  getFieldRefs: () => Promise<AutoIncrementFieldRef[]>;

  /** Get status for all auto-incrementers in the project */
  getAllStatuses: () => Promise<AutoIncrementStatus[]>;

  /**
   * Generate initial values for all auto-increment fields in a form.
   * Call this when creating a new record.
   * Returns a map of fieldId -> value
   */
  generateInitialValues: (
    formId: string,
    numDigits?: number
  ) => Promise<Record<string, string>>;

  /** A callback to fire to the parent if there is an issue with the configured
   * ranges */
  onIssue: (refs: AutoIncrementFieldRef[], onResolved: () => void) => void;
};
