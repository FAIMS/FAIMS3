import {AvpUpdateMode} from '@faims3/data-model';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Box, Button, CircularProgress} from '@mui/material';
import {useCallback, useState} from 'react';

export interface ParentNavInfo {
  link: string;
  mode: AvpUpdateMode;
  recordId: string;
  label: string;
  fieldId: string;
  formId: string;
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
}

/**
 * Mobile-friendly navigation buttons for form navigation.
 * Displays outlined buttons with back arrows for returning to parent records
 * or the record list.
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

  // Extract HRID from label (removes "Return to " prefix if present)
  const hrid = parentNavInfo?.label.replace('Return to ', '') ?? '';

  // Show subtle indicator when there are pending changes
  const showPendingIndicator = hasPendingChanges?.() && !isSaving;

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, mb: 2}}>
      {parentNavInfo && onNavigateToParent && (
        <Button
          variant="outlined"
          disabled={isSaving}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1,
            textTransform: 'none',
            width: '100%',
          }}
          onClick={handleParentNavigation}
        >
          <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
            {isSaving ? (
              <CircularProgress size={20} />
            ) : (
              <ArrowBackIcon fontSize="small" />
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Box component="span" sx={{fontSize: '0.875rem'}}>
              Return to parent {parentFormLabel ? `(${parentFormLabel})` : ''}
              {showPendingIndicator && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    fontSize: '0.75rem',
                    color: 'warning.main',
                  }}
                >
                  (saving...)
                </Box>
              )}
            </Box>
            <Box
              component="span"
              sx={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
                fontSize: '0.75rem',
                color: 'text.secondary',
              }}
            >
              {hrid}
            </Box>
          </Box>
        </Button>
      )}

      <Button
        variant="outlined"
        disabled={isSaving}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1,
          textTransform: 'none',
          width: '100%',
        }}
        onClick={handleRecordListNavigation}
      >
        <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
          {isSaving ? (
            <CircularProgress size={20} />
          ) : (
            <ArrowBackIcon fontSize="small" />
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            component="span"
            sx={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            {navigateToRecordList.label}
            {showPendingIndicator && (
              <Box
                component="span"
                sx={{
                  ml: 1,
                  fontSize: '0.75rem',
                  color: 'warning.main',
                }}
              >
                (saving...)
              </Box>
            )}
          </Box>
        </Box>
      </Button>
    </Box>
  );
};
