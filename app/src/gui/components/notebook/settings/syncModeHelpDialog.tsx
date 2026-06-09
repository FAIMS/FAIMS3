import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useState, type ReactNode} from 'react';
import {
  SYNC_MODE_HELP_MODES,
  SyncModeHelpContent,
} from '../../../../sync/syncModeHelpContent';
import {SYNC_MODE_LABELS} from '../../../../sync/syncMode';

function SyncModeExplanation({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{mb: 2}}>
      <Typography variant="subtitle1" sx={{fontWeight: 'bold', mb: 0.5}}>
        {title}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

type SyncModeHelpDialogProps = {
  recordCount?: number;
};

export default function SyncModeHelpDialog({
  recordCount,
}: SyncModeHelpDialogProps) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      <IconButton
        aria-label="Sync mode help"
        size="small"
        onClick={() => setOpen(true)}
        sx={{
          padding: 0,
          '&:hover': {
            backgroundColor: 'transparent',
          },
        }}
      >
        <InfoOutlinedIcon
          sx={{
            fontSize: '1.6rem',
            color: theme.palette.secondary.main,
          }}
        />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              p: 1,
              boxShadow: theme.shadows[8],
              position: 'relative',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 'bold',
            fontSize: '1.2rem',
            paddingRight: 4,
          }}
        >
          Sync Mode
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{position: 'absolute', right: 16, top: 16}}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{maxHeight: '60vh', overflowY: 'auto'}}>
          {SYNC_MODE_HELP_MODES.map(mode => (
            <SyncModeExplanation key={mode} title={SYNC_MODE_LABELS[mode]}>
              <SyncModeHelpContent mode={mode} recordCount={recordCount} />
            </SyncModeExplanation>
          ))}
        </DialogContent>

        <DialogActions sx={{pt: 2, justifyContent: 'flex-end'}}>
          <Button
            onClick={() => setOpen(false)}
            variant="contained"
            disableElevation
            sx={{
              backgroundColor: theme.palette.dialogButton.confirm,
              color: theme.palette.dialogButton.dialogText,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              px: 2.5,
              '&:hover': {
                backgroundColor: theme.palette.dialogButton.hoverBackground,
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
