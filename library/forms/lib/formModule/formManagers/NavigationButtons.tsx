import {AvpUpdateMode} from '@faims3/data-model';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Box, Button} from '@mui/material';

export interface ParentNavInfo {
  link: string;
  mode: AvpUpdateMode;
  recordId: string;
  label: string;
  fieldId: string;
}

interface NavigateToRecordList {
  navigate: () => void;
  label: string;
}

interface ToRecordParams {
  mode: AvpUpdateMode;
  recordId: string;
  stripNavigationEntry: boolean;
  scrollTarget: {fieldId: string};
}

export interface FormNavigationButtonsProps {
  parentNavInfo?: ParentNavInfo | null;
  parentFormLabel?: string;
  navigateToRecordList: NavigateToRecordList;
  onNavigateToParent?: (params: ToRecordParams) => void;
}

/**
 * Mobile-friendly navigation buttons for form navigation.
 * Displays outlined buttons with back arrows for returning to parent records
 * or the record list.
 */
export const FormNavigationButtons = ({
  parentNavInfo,
  parentFormLabel,
  navigateToRecordList,
  onNavigateToParent,
}: FormNavigationButtonsProps) => {
  const handleParentNavigation = () => {
    if (parentNavInfo && onNavigateToParent) {
      onNavigateToParent({
        mode: parentNavInfo.mode,
        recordId: parentNavInfo.recordId,
        stripNavigationEntry: true,
        scrollTarget: {fieldId: parentNavInfo.fieldId},
      });
    }
  };

  // Extract HRID from label (removes "Return to " prefix if present)
  const hrid = parentNavInfo?.label.replace('Return to ', '') ?? '';

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, mb: 2}}>
      {parentNavInfo && onNavigateToParent && (
        <Button
          variant="outlined"
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
            <ArrowBackIcon fontSize="small" />
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
              Return to parent ({parentFormLabel ?? parentNavInfo.mode})
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
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1,
          textTransform: 'none',
          width: '100%',
        }}
        onClick={navigateToRecordList.navigate}
      >
        <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
          <ArrowBackIcon fontSize="small" />
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
          </Box>
        </Box>
      </Button>
    </Box>
  );
};
