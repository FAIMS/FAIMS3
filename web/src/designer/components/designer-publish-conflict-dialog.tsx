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

type DesignerPublishConflictDialogProps = {
  open: boolean;
  busy: boolean;
  animationDuration: number;
  onDismiss: () => void;
  onSwitchToLatest: () => void;
  onForcePublish: () => void;
  onDownloadBackup: () => void;
};

const CONFLICT_COPY =
  'The {notebook} has been updated remotely since you created your draft. You can either switch to the latest version (losing your draft changes) or forcefully overwrite the latest version. You can download your draft design as a backup, if needed.';

const conflictButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
} as const;

/**
 * Shown when PUT /uiSpecification returns 409 (If-Match hash mismatch).
 */
export function DesignerPublishConflictDialog({
  open,
  busy,
  animationDuration,
  onDismiss,
  onSwitchToLatest,
  onForcePublish,
  onDownloadBackup,
}: DesignerPublishConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onDismiss}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="publish-conflict-dialog-title"
      aria-describedby="publish-conflict-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle
        id="publish-conflict-dialog-title"
        sx={designerDialogTitleWithCloseSx}
      >
        Could not publish
        <DesignerDialogCloseButton
          onClick={onDismiss}
          disabled={busy}
          data-testid="web-designer-conflict-dismiss-button"
        />
      </DialogTitle>
      <DialogContent sx={{'&&': {pt: 1}}}>
        <DialogContentText id="publish-conflict-dialog-description">
          {brandNotebook(CONFLICT_COPY)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 2, pb: 2}}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onSwitchToLatest}
          disabled={busy}
          autoFocus
          data-testid="web-designer-conflict-switch-latest-button"
          sx={{...conflictButtonSx, color: 'text.secondary'}}
        >
          Switch to latest version
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={onForcePublish}
          disabled={busy}
          data-testid="web-designer-conflict-overwrite-button"
          sx={conflictButtonSx}
        >
          Forcefully publish
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={onDownloadBackup}
          disabled={busy}
          data-testid="web-designer-conflict-download-backup-button"
          sx={{...conflictButtonSx, color: 'text.secondary'}}
        >
          Download JSON backup
        </Button>
      </DialogActions>
    </Dialog>
  );
}
