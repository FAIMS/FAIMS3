import {AvpUpdateMode} from '@faims3/data-model';
import {useCallback, useMemo, useState} from 'react';
import {
  NavigationButtonsConfig,
  NavigationButtonsTemplate,
} from './NavigationButtonsTemplate';

export interface ParentNavInfo {
  link: string;
  mode: AvpUpdateMode;
  recordId: string;
  label: string;
  fieldId: string;
  formId: string;
}

/**
 * Represents an inferred parent record when no explicit navigation history exists.
 * This is typically derived from the record's relationship field, allowing users
 * to navigate to a likely parent even when they arrived at the record directly
 * (e.g., via URL or search) rather than through parent-child navigation.
 */
export interface ImpliedParentNavInfo {
  /** The record ID of the implied parent */
  recordId: string;
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
  /** Optional: handler to navigate to the view record page (shown when no parent context) */
  onNavigateToViewRecord?: () => void;
  /**
   * Optional: inferred parent navigation info when no explicit navigation history exists.
   *
   * This can be supplied to indicate a likely parent record, typically derived from
   * the record's `relationship` field. Useful when the user navigates directly to a
   * child record (e.g., via URL, search, or deep link) without going through the
   * parent first.
   *
   * When provided and there is no explicit navigation context (parentNavInfo),
   * a "Go to parent" button will be shown allowing navigation to this inferred parent.
   */
  impliedParentNavInfo?: ImpliedParentNavInfo | null;
}

/**
 * Mobile-friendly navigation buttons for form navigation.
 * Displays outlined buttons with back arrows for returning to parent records
 * or the record list.
 *
 * Navigation priority:
 * 1. If explicit parentNavInfo exists (from navigation history), show "Return to parent"
 * 2. If no history but impliedParentNavInfo exists, show "Go to parent" (inferred from relationships)
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

  const handleImpliedParentNavigation = useCallback(async () => {
    if (impliedParentNavInfo) {
      await withFlush(impliedParentNavInfo.onNavigate)();
    }
  }, [impliedParentNavInfo, withFlush]);

  // Extract HRID from label (removes "Return to " prefix if present)
  const hrid = parentNavInfo?.label.replace('Return to ', '') ?? '';

  // Show subtle indicator when there are pending changes
  const showPendingIndicator = hasPendingChanges?.() && !isSaving;
  const statusText = showPendingIndicator ? 'saving...' : undefined;

  // Determine if we have an explicit parent navigation context (from nav history)
  const hasExplicitParentContext = parentNavInfo && onNavigateToParent;

  const buttons = useMemo(() => {
    const result: NavigationButtonsConfig[] = [];

    if (hasExplicitParentContext) {
      // Explicit parent from navigation history - use "Return to parent"
      result.push({
        label: `Return to parent${
          parentFormLabel ? ` (${parentFormLabel})` : ''
        }`,
        subtitle: hrid,
        onClick: handleParentNavigation,
        disabled: isSaving,
        loading: isSaving,
        statusText,
      });
    } else {
      // No explicit navigation history

      // Show "Go to parent" if we have an implied parent (from relationship field)
      if (impliedParentNavInfo) {
        result.push({
          label: `Return to parent (${impliedParentNavInfo.formId})`,
          subtitle: impliedParentNavInfo.label,
          onClick: handleImpliedParentNavigation,
          disabled: isSaving,
          loading: isSaving,
          statusText,
        });
      }

      // Show "Return to view record" if handler provided
      if (onNavigateToViewRecord) {
        result.push({
          label: 'Return to view record',
          onClick: handleViewRecordNavigation,
          disabled: isSaving,
          loading: isSaving,
          statusText,
        });
      }
    }

    result.push({
      label: navigateToRecordList.label,
      onClick: handleRecordListNavigation,
      disabled: isSaving,
      loading: isSaving,
      statusText,
    });

    return result;
  }, [
    hasExplicitParentContext,
    parentFormLabel,
    hrid,
    handleParentNavigation,
    isSaving,
    statusText,
    onNavigateToViewRecord,
    handleViewRecordNavigation,
    impliedParentNavInfo,
    handleImpliedParentNavigation,
    navigateToRecordList.label,
    handleRecordListNavigation,
  ]);

  return <NavigationButtonsTemplate buttons={buttons} />;
};
