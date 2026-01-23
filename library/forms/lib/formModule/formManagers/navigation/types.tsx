import {AvpUpdateMode} from '@faims3/data-model';
import {ReactNode} from 'react';

// ============================================================================
// Core Navigation Types
// ============================================================================

/**
 * Represents the type of relationship between records.
 * - 'parent': A hierarchical parent-child relationship
 * - 'linked': A non-hierarchical association between records
 */
export type RelationshipType = 'parent' | 'linked';

/**
 * Determines the navigation context based on how the user arrived at this record.
 * - 'parent': User is editing a top-level/root record
 * - 'child': User navigated here from a parent record
 */
export type NavigationType = 'parent' | 'child';

// ============================================================================
// Navigation Information Types
// ============================================================================

/**
 * Information about explicit parent navigation derived from navigation history.
 * This represents a known parent record that the user navigated through to
 * reach the current record.
 */
export interface ExplicitParentNavInfo {
  /** Direct link to the parent record */
  link: string;
  /** The update mode to use when navigating back */
  mode: AvpUpdateMode;
  /** The parent record's ID */
  recordId: string;
  /** Display label for the navigation button */
  label: string;
  /** The field in the parent that links to this record */
  fieldId: string;
  /** The form/viewset ID of the parent record */
  formId: string;
  /** How this record relates to the parent */
  relationType: RelationshipType;
}

/**
 * Information about an inferred/implied parent when no explicit navigation
 * history exists. Typically derived from the record's relationship field,
 * allowing users to navigate to a likely parent even when they arrived at
 * the record directly (e.g., via URL or search).
 */
export interface ImpliedParentNavInfo {
  /** The type of relationship to this implied parent */
  type: RelationshipType;
  /** The record ID of the implied parent */
  recordId: string;
  /** The field that established this relationship */
  fieldId: string;
  /** The form/viewset ID of the parent record */
  formId: string;
  /** Display label (e.g., HRID or descriptive name) */
  label: string;
  /** Handler to navigate to this implied parent */
  onNavigate: () => void;
}

/**
 * Configuration for the "create another child" functionality.
 * Shown when the user created (not linked) a child record and may want
 * to create additional siblings.
 */
export interface CreateAnotherChildConfig {
  /** Label for the type of child being created (e.g., 'Building') */
  formLabel: string;
  /** Label for the parent form (e.g., 'Site') */
  parentFormLabel: string;
  /** Label for the field this child was created from (e.g., 'Site buildings') */
  fieldLabel: string;
  /** Handler to create and navigate to a new sibling record */
  onCreate: () => void;
  /** The type of relationship for the new child */
  relationType: RelationshipType;
}

// ============================================================================
// Button Configuration Types
// ============================================================================

/**
 * Visual variant for navigation buttons.
 * - 'primary': Main action button (e.g., "Finish")
 * - 'secondary': Supporting action (e.g., "Create another")
 * - 'tertiary': Less prominent action (e.g., implied parent navigation)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

/**
 * Configuration for a single navigation button.
 * This is the data structure passed to the display layer.
 */
export interface NavigationButtonConfig {
  /** Unique identifier for this button */
  id: string;
  /** Primary button label */
  label: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Click handler */
  onClick: () => void | Promise<void>;
  /** Whether the button is disabled */
  disabled: boolean;
  /** Whether to show a loading spinner */
  loading: boolean;
  /** Optional status text (e.g., "saving...") */
  statusText?: string;
  /** Icon to display */
  icon: ReactNode;
  /** Visual variant */
  variant: ButtonVariant;
}

/**
 * Handler configuration for the form completion action.
 * Used by parent components that need to trigger completion programmatically.
 */
export interface OnCompleteHandler {
  /** Label for the completion action */
  label: string;
  /** Handler to execute on completion */
  onClick: () => void | Promise<void>;
}

// ============================================================================
// Hook Input/Output Types
// ============================================================================

/**
 * Parameters for navigating to a specific record.
 */
export interface ToRecordParams {
  /** The update mode for the target record */
  mode: AvpUpdateMode;
  /** The target record's ID */
  recordId: string;
  /** Number of navigation entries to strip (for back navigation) */
  stripNavigationEntry?: number;
  /** Field to scroll to after navigation */
  scrollTarget?: {fieldId: string};
}

/**
 * Navigation service interface - abstracts navigation operations.
 * This allows the hook to remain decoupled from routing implementation.
 */
export interface NavigationService {
  /** Navigate to a specific record */
  toRecord: (params: ToRecordParams) => void;
  /** Navigate to the record list */
  navigateToRecordList: {
    navigate: () => void;
    label: string;
  };
  /** Navigate to view mode for a record */
  navigateToViewRecord?: (params: {recordId: string}) => void;
}

/**
 * Input parameters for the useNavigationLogic hook.
 */
export interface UseNavigationLogicParams {
  /** Label for the current form being edited */
  currentFormLabel: string;
  /** Whether this is a parent or child record in the navigation hierarchy */
  navigationType: NavigationType;
  /** Explicit parent navigation info from navigation history */
  explicitParentInfo: ExplicitParentNavInfo | null;
  /** Navigation service for executing navigation actions */
  navigationService: NavigationService;
  /** Function to flush pending form saves before navigation */
  flushSave: () => Promise<void>;
  /** Function to check for pending unsaved changes */
  hasPendingChanges: () => boolean;
  /** Inferred parent records when no explicit navigation history exists */
  impliedParents?: ImpliedParentNavInfo[];
  /** Configuration for creating another sibling record */
  createAnotherChild?: CreateAnotherChildConfig;
}

/**
 * Output from the useNavigationLogic hook.
 */
export interface UseNavigationLogicResult {
  /** Ordered array of button configurations to render */
  buttons: NavigationButtonConfig[];
  /** Handler for form completion (for programmatic access) */
  onCompleteHandler: OnCompleteHandler;
  /** Whether a save operation is currently in progress */
  isSaving: boolean;
}
