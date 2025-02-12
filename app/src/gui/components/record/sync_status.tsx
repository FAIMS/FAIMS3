import CheckIcon from '@mui/icons-material/Check';
import SaveIcon from '@mui/icons-material/Save';
import {Alert, Box} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import 'animate.css';
import {useLoadingDebounce} from '../../../utils/customHooks';

interface DraftSyncStatusProps {
  last_saved: Date | null;
  is_saving: boolean;
  error: string | null;
}
export default function DraftSyncStatus(props: DraftSyncStatusProps) {
  /**
   * TODO the draft sync state from the form needs hoisting to the record component
   * then passing to this component as prop, to ensure that we can see the sync status
   * at all times (i.e., not just on the edit tab)
   */
  const theme = useTheme();
  const throttledSave = useLoadingDebounce(props.is_saving);

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: '65px',
        textAlign: 'right',
      }}
    >
      {props.error ? (
        <Alert severity={'error'} sx={{borderRadius: 0}}>
          A local draft could not be saved to your device: {props.error}
        </Alert>
      ) : (
        <Box
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 'bold',
          }}
          p={1}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'end',
            }}
          >
            {throttledSave ? (
              <>
                <SaveIcon
                  className={
                    'animate__animated animate__flash animate__slow animate__infinite'
                  }
                />
              </>
            ) : (
              <>
                <CheckIcon />
                <SaveIcon />
              </>
            )}
          </div>
        </Box>
      )}
    </Box>
  );
}
