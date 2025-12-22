import {AvpUpdateMode} from '@faims3/data-model';
import {useCallback, useMemo, useState} from 'react';
import {
  NavigationButtonsConfig,
  NavigationButtonsTemplate,
} from './NavigationButtonsTemplate';
import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';

type RelationshipType = 'parent' | 'linked';

export interface ParentNavInfo {
  link: string;
  mode: AvpUpdateMode;
  recordId: string;
  label: string;
  fieldId: string;
  formId: string;
  relationType: RelationshipType;
}

/**
 * Represents an inferred parent record when no explicit navigation history
 * exists. This is typically derived from the record's relationship field,
 * allowing users to navigate to a likely parent even when they arrived at the
 * record directly (e.g., via viewing directly) rather than through parent-child
 * navigation.
 */
export interface ImpliedParentNavInfo {
  /** What relationship type? */
  type: RelationshipType;
  /** The record ID of the implied parent */
  recordId: string;
  /** Which field did this come from? */
  fieldId: string;
  /** The form/viewset ID of the parent record */
  formId: string;
  /** Display label for the parent (e.g., HRID or descriptive name) */
  label: string;
  /** Handler to navigate to the implied parent record */
  onNavigate: () => void;
}

interface NavigateToRecordList {
  navigate: () => void;
  label: string;
}

interface ToRecordParams {
  mode: AvpUpdateMode;
  recordId: string;
  stripNavigationEntry?: number;
  scrollTarget: {fieldId: string};
}

export interface FormNavigationButtonsProps {
  parentNavInfo?: ParentNavInfo | null;
  parentFormLabel?: string;
  navigateToRecordList: NavigateToRecordList;
  onNavigateToParent?: (params: ToRecordParams) => void;
  /** Function to flush any pending form saves before navigation */
  flushSave?: () => Promise<void>;
  /** Optional: check if there are pending changes (for UI feedback) */
  hasPendingChanges?: () => boolean;
  /** Optional: handler to navigate to the view record page (shown when no
   * parent context) */
  onNavigateToViewRecord?: () => void;
  /**
   * Optional: inferred parent navigation info when no explicit navigation
   * history exists.
   *
   * This can be supplied to indicate likely parent/linked records, typically
   * derived from the record's `relationship` field. Useful when the user
   * navigates directly to a child record (e.g., via URL, search, or deep link)
   * without going through the parent first.
   *
   * When provided (and non-empty) and there is no explicit navigation context
   * (parentNavInfo), navigation buttons will be shown for each inferred
   * parent/linked record.
   */
  impliedParentNavInfo?: ImpliedParentNavInfo[] | null;

  /**
   * Do we want to enable the creation of 'another child' requires that a) we
   * reached this point explicitly b) we used the 'create' not the 'link
   * existing' function of the related record selector
   */
  createAnotherChild?: {
    // The label of type of child to create E.g. 'Building'
    formLabel: string;
    // A label for the parent form - where did it come from? E.g. 'Site'
    parentFormLabel: string;
    // The label of the field that this child was created from E.g. 'Site
    // buildings'
    fieldLabel: string;
    // The function to create and navigate to this new child
    onCreate: () => void;
    // What type of relationship
    relationType: RelationshipType;
  };
}

/**
 * Mobile-friendly navigation buttons for form navigation.
 * Displays outlined buttons with back arrows for returning to parent records
 * or the record list.
 *
 * Navigation priority:
 * 1. If explicit parentNavInfo exists (from navigation history), show "Return to parent"
 * 2. If no history but impliedParentNavInfo exists, show buttons for each inferred parent/linked record
 * 3. If onNavigateToViewRecord is provided and no parent context, show "Return to view record"
 * 4. Always show "Return to record list"
 *
 * When flushSave is provided, buttons will flush pending form changes before
 * navigating to ensure no data is lost.
 */
export const FormNavigationButtons = ({
  parentNavInfo,
  parentFormLabel,
  navigateToRecordList,
  onNavigateToParent,
  flushSave,
  hasPendingChanges,
  onNavigateToViewRecord,
  impliedParentNavInfo,
  createAnotherChild,
}: FormNavigationButtonsProps) => {
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Wraps a navigation action with flush logic.
   * Flushes pending saves before executing navigation.
   */
  const withFlush = useCallback(
    (navigationFn: () => void) => async () => {
      if (flushSave) {
        setIsSaving(true);
        try {
          await flushSave();
        } catch (error) {
          console.error(
            '[FormNavigationButtons] Failed to flush save before navigation:',
            error
          );
          // Continue with navigation even if flush fails - data is likely
          // already saved or will be on next sync
        } finally {
          setIsSaving(false);
        }
      }
      navigationFn();
    },
    [flushSave]
  );

  const handleParentNavigation = useCallback(async () => {
    if (parentNavInfo && onNavigateToParent) {
      await withFlush(() => {
        onNavigateToParent({
          mode: parentNavInfo.mode,
          recordId: parentNavInfo.recordId,
          stripNavigationEntry: 1,
          scrollTarget: {fieldId: parentNavInfo.fieldId},
        });
      })();
    }
  }, [parentNavInfo, onNavigateToParent, withFlush]);

  const handleRecordListNavigation = useCallback(async () => {
    await withFlush(navigateToRecordList.navigate)();
  }, [navigateToRecordList.navigate, withFlush]);

  const handleViewRecordNavigation = useCallback(async () => {
    if (onNavigateToViewRecord) {
      await withFlush(onNavigateToViewRecord)();
    }
  }, [onNavigateToViewRecord, withFlush]);

  /**
   * Creates a navigation handler for a specific implied parent.
   * Each implied parent gets its own handler that wraps its onNavigate with flush logic.
   */
  const createImpliedParentNavigationHandler = useCallback(
    (impliedParent: ImpliedParentNavInfo) => async () => {
      await withFlush(impliedParent.onNavigate)();
    },
    [withFlush]
  );

  // Extract HRID from label (removes "Return to " prefix if present)
  const hrid = parentNavInfo?.label.replace('Return to ', '') ?? '';

  // Show subtle indicator when there are pending changes
  const showPendingIndicator = hasPendingChanges?.() && !isSaving;
  const statusText = showPendingIndicator ? 'saving...' : undefined;

  // Determine if we have an explicit parent navigation context (from nav history)
  const hasExplicitParentContext = parentNavInfo && onNavigateToParent;

  // Normalize implied parent info to an array (empty if null/undefined)
  const normalizedImpliedParents = useMemo(
    () => impliedParentNavInfo ?? [],
    [impliedParentNavInfo]
  );

  const buttons = useMemo(() => {
    const result: NavigationButtonsConfig[] = [];

    result.push({
      label: navigateToRecordList.label,
      onClick: handleRecordListNavigation,
      disabled: isSaving,
      loading: isSaving,
      statusText,
    });

    if (hasExplicitParentContext) {
      const relLabel =
        parentNavInfo.relationType === 'linked' ? 'related' : 'parent';
      // Explicit parent from navigation history - use "Return to parent"
      result.push({
        label: parentFormLabel
          ? `Go to ${parentFormLabel} (${relLabel})`
          : `Go to ${relLabel}`,
        onClick: handleParentNavigation,
        disabled: isSaving,
        loading: isSaving,
        statusText,
      });
    } else {
      // No explicit navigation history
      // Show navigation buttons for each implied parent/linked record (from relationship field)
      for (const impliedParent of normalizedImpliedParents) {
        const relLabel = impliedParent.type === 'linked' ? 'related' : 'parent';
        result.push({
          label: `Go to ${impliedParent.formId} (${relLabel})`,
          onClick: createImpliedParentNavigationHandler(impliedParent),
          disabled: isSaving,
          loading: isSaving,
          statusText,
        });
      }

      // Show "Return to view record" if handler provided
      if (onNavigateToViewRecord) {
        result.push({
          label: 'Review record',
          onClick: handleViewRecordNavigation,
          disabled: isSaving,
          loading: isSaving,
          statusText,
          icon: <DoneIcon fontSize="small" />,
        });
      }
    }

    // Create another child button, if needed
    if (createAnotherChild) {
      const {fieldLabel, formLabel, onCreate, parentFormLabel, relationType} =
        createAnotherChild;
      const relLabel = relationType === 'parent' ? 'parent' : 'related';
      result.push({
        label: `Create another ${formLabel} in ${relLabel} ${parentFormLabel}`,
        subtitle: `Create and link a new ${formLabel} from ${relLabel} ${parentFormLabel} in field '${fieldLabel}'`,
        onClick: onCreate,
        disabled: isSaving,
        loading: isSaving,
        statusText,
        icon: <AddIcon fontSize="small" />,
      });
    }

    return result;
  }, [
    hasExplicitParentContext,
    parentNavInfo,
    parentFormLabel,
    hrid,
    handleParentNavigation,
    isSaving,
    statusText,
    normalizedImpliedParents,
    createImpliedParentNavigationHandler,
    onNavigateToViewRecord,
    handleViewRecordNavigation,
    navigateToRecordList.label,
    handleRecordListNavigation,
  ]);

  return <NavigationButtonsTemplate buttons={buttons} />;
};
