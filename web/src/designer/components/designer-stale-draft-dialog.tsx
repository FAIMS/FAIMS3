// SPDX-License-Identifier: Apache-2.0

import {brandNotebook} from '@/constants';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
} from '@mui/material';
import {
  DesignerDialogCloseButton,
  designerDialogTitleWithCloseSx,
} from './designer-dialog-close-button';

type DesignerStaleDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onDismiss: () => void;
  onSwitchToLatest: () => void;
  onWorkOnMyVersion: () => void;
  onDownloadBackup: () => void;
};

const STALE_DRAFT_COPY =
  'The {notebook} has been updated remotely since you created your draft. You can switch to the latest version (losing your draft changes). You may continue working on your stale draft, but beware that you will need to overwrite the latest version in order to save it. You can download your draft design as a backup, if needed.';

const staleButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
} as const;

/**
 * Open-time warning when a local draft is based on an older published design.
 */
export function DesignerStaleDraftDialog({
  open,
  animationDuration,
  onDismiss,
  onSwitchToLatest,
  onWorkOnMyVersion,
  onDownloadBackup,
}: DesignerStaleDraftDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="stale-draft-dialog-title"
      aria-describedby="stale-draft-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle
        id="stale-draft-dialog-title"
        sx={designerDialogTitleWithCloseSx}
      >
        Warning: this design has changed
        <DesignerDialogCloseButton
          onClick={onDismiss}
          data-testid="web-designer-stale-dismiss-button"
        />
      </DialogTitle>
      <DialogContent sx={{'&&': {pt: 1}}}>
        <DialogContentText id="stale-draft-dialog-description">
          {brandNotebook(STALE_DRAFT_COPY)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 2, pb: 2}}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onSwitchToLatest}
          autoFocus
          data-testid="web-designer-stale-load-live-button"
          sx={{...staleButtonSx, color: 'text.secondary'}}
        >
          Switch to latest version
        </Button>
        <Button
          variant="outlined"
          color="warning"
          onClick={onWorkOnMyVersion}
          data-testid="web-designer-stale-continue-button"
          sx={staleButtonSx}
        >
          Work on my version
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={onDownloadBackup}
          data-testid="web-designer-stale-download-backup-button"
          sx={{...staleButtonSx, color: 'text.secondary'}}
        >
          Download JSON backup
        </Button>
      </DialogActions>
    </Dialog>
  );
}
