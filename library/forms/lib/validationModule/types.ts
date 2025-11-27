import {z} from 'zod';

export type VisibilityBehaviour = 'ignore' | 'include';

export type ValidationSettings = {
  // Behaviour for handling data which is provided but which is not visible due
  // to conditional logic @default ignore
  visibleBehaviour: VisibilityBehaviour;
};

// Zod's issue type for full type information
export type ValidationError = z.core.$ZodIssue;

export type ValidationResult =
  | {valid: true}
  | {valid: false; errors: ValidationError[]};

export type FieldValidationResult =
  | {valid: true}
  | {valid: false; errors: ValidationError[]};
