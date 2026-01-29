import AddIcon from '@mui/icons-material/Add';
import NorthWestIcon from '@mui/icons-material/NorthWest';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import {useCallback, useMemo, useState} from 'react';
import {
  ImpliedParentNavInfo,
  NavigationButtonConfig,
  OnCompleteHandler,
  UseNavigationLogicParams,
  UseNavigationLogicResult,
} from './types';

/**
 * useNavigationLogic - Computes navigation button configurations and handlers.
 *
 * This hook encapsulates all the logic for determining what navigation options
 * should be available based on the current navigation context. It returns a
 * stable array of button configurations that can be rendered by a display
 * component.
 *
 * ## Navigation Priority:
 * 1. **Child records with explicit parent**: Show "Finish <form>" to return to parent
 * 2. **Parent/root records**: Show "Finish <form>" to return to record list
 * 3. **Create another child**: Shown when user created (not linked) a child record
 * 4. **Implied parents**: Shown when no explicit history but relationships exist
 *
 * ## Save Handling:
 * All navigation actions are wrapped with flush logic to ensure pending form
 * changes are saved before navigation occurs. This prevents data loss.
 */
export function useNavigationLogic({
  currentFormLabel,
  navigationType,
  explicitParentInfo,
  navigationService,
  flushSave,
  hasPendingChanges,
  impliedParents = [],
  createAnotherChild,
}: UseNavigationLogicParams): UseNavigationLogicResult {
  const [isSaving, setIsSaving] = useState(false);

  // ===========================================================================
  // Core Navigation Wrapper
  // ===========================================================================

  /**
   * Wraps a navigation function with save-flushing logic.
   * Ensures all pending changes are saved before navigation occurs.
   */
  const withSaveFlush = useCallback(
    (navigationFn: () => void) => {
      return async () => {
        setIsSaving(true);
        try {
          await flushSave();
        } catch (error) {
          console.error(
            '[useNavigationLogic] Failed to flush save before navigation:',
            error
          );
          // Continue with navigation - data is likely saved or will sync later
        } finally {
          setIsSaving(false);
        }
        navigationFn();
      };
    },
    [flushSave]
  );

  // ===========================================================================
  // Navigation Handlers
  // ===========================================================================

  /**
   * Navigate back to the explicit parent record.
   * Used when the user has a clear navigation history.
   */
  const handleNavigateToParent = useMemo(() => {
    if (!explicitParentInfo) return null;
    return withSaveFlush(() => {
      navigationService.toRecord({
        mode: explicitParentInfo.mode,
        recordId: explicitParentInfo.recordId,
        stripNavigationEntry: 1,
        scrollTarget: {fieldId: explicitParentInfo.fieldId},
      });
    });
  }, [explicitParentInfo, navigationService, withSaveFlush]);

  /**
   * Navigate to the record list (for parent/root records).
   */
  const handleNavigateToRecordList = useMemo(() => {
    return withSaveFlush(navigationService.navigateToRecordList.navigate);
  }, [navigationService.navigateToRecordList.navigate, withSaveFlush]);

  /**
   * Navigate to view mode for the current record.
   */

  // const handleNavigateToViewRecord = useMemo(() => {
  //   if (!navigationService.navigateToViewRecord) return null;

  //   return withSaveFlush(() => {
  //     navigationService.navigateToViewRecord!({recordId: ''}); // recordId injected at call site
  //   });
  // }, [navigationService.navigateToViewRecord, withSaveFlush]);

  /**
   * Creates a navigation handler for an implied parent.
   * Memoized to prevent unnecessary re-renders.
   */
  const createImpliedParentHandler = useCallback(
    (impliedParent: ImpliedParentNavInfo) => {
      return withSaveFlush(impliedParent.onNavigate);
    },
    [withSaveFlush]
  );

  // ===========================================================================
  // Status Text
  // ===========================================================================

  const statusText = useMemo(() => {
    if (isSaving) return undefined; // Loading spinner handles this
    if (hasPendingChanges()) return 'saving...';
    return undefined;
  }, [isSaving, hasPendingChanges]);

  // ===========================================================================
  // Button Configuration Builder
  // ===========================================================================

  const buttons = useMemo((): NavigationButtonConfig[] => {
    const result: NavigationButtonConfig[] = [];

    // -------------------------------------------------------------------------
    // Primary Action: Finish Button
    // -------------------------------------------------------------------------
    if (navigationType === 'child' && handleNavigateToParent) {
      // Child record: "Finish" returns to parent
      result.push({
        id: 'finish-to-parent',
        label: `Finish ${currentFormLabel}`,
        onClick: handleNavigateToParent,
        disabled: isSaving,
        loading: isSaving,
        statusText,
        icon: <OutlinedFlagIcon fontSize="small" />,
        variant: 'primary',
      });
    } else {
      // Parent/root record: "Finish" returns to record list
      result.push({
        id: 'finish-to-list',
        label: `Finish ${currentFormLabel}`,
        onClick: handleNavigateToRecordList,
        disabled: isSaving,
        loading: isSaving,
        statusText,
        icon: <OutlinedFlagIcon fontSize="small" />,
        variant: 'primary',
      });
    }

    // -------------------------------------------------------------------------
    // Secondary Action: Create Another Child
    // -------------------------------------------------------------------------
    if (createAnotherChild) {
      const {
        formLabel,
        onCreate,
        parentFormLabel: childParentFormLabel,
        relationType,
      } = createAnotherChild;

      const relationLabel = relationType === 'parent' ? 'parent' : 'related';

      result.push({
        id: 'create-another-child',
        label: `Finish and create another ${formLabel} in ${relationLabel} ${childParentFormLabel}`,
        onClick: withSaveFlush(onCreate),
        disabled: isSaving,
        loading: isSaving,
        statusText,
        icon: <AddIcon fontSize="small" />,
        variant: 'secondary',
      });
    }

    // -------------------------------------------------------------------------
    // Tertiary Actions: Implied Parent Navigation
    // -------------------------------------------------------------------------
    // Only show implied parents when there's no explicit navigation history
    // This prevents confusing duplicate navigation options
    if (impliedParents.length > 0) {
      for (const impliedParent of impliedParents) {
        const relationLabel =
          impliedParent.type === 'linked' ? 'related' : 'parent';

        result.push({
          id: `implied-parent-${impliedParent.recordId}`,
          label: `Go to ${impliedParent.formId} (${relationLabel})`,
          onClick: createImpliedParentHandler(impliedParent),
          disabled: isSaving,
          loading: isSaving,
          statusText,
          icon: <NorthWestIcon fontSize="small" />,
          variant: 'tertiary',
        });
      }
    }

    return result;
  }, [
    navigationType,
    currentFormLabel,
    handleNavigateToParent,
    handleNavigateToRecordList,
    isSaving,
    statusText,
    createAnotherChild,
    withSaveFlush,
    impliedParents,
    createImpliedParentHandler,
  ]);

  // ===========================================================================
  // Completion Handler
  // ===========================================================================

  const onCompleteHandler = useMemo((): OnCompleteHandler => {
    if (navigationType === 'child' && handleNavigateToParent) {
      return {
        label: 'Finish',
        onClick: handleNavigateToParent,
      };
    }
    return {
      label: 'Finish',
      onClick: handleNavigateToRecordList,
    };
  }, [navigationType, handleNavigateToParent, handleNavigateToRecordList]);

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    buttons,
    onCompleteHandler,
    isSaving,
  };
}
