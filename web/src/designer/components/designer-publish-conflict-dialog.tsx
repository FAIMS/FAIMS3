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

type DesignerPublishConflictDialogProps = {
  open: boolean;
  busy: boolean;
  animationDuration: number;
  onKeepWorking: () => void;
  onOverwrite: () => void;
};

const CONFLICT_COPY =
  'The live {notebook} design has changed since this draft. Publishing was not applied. You can keep working on the local draft, or overwrite the live design.';

/**
 * Shown when PUT /uiSpecification returns 409 (If-Match hash mismatch).
 */
export function DesignerPublishConflictDialog({
  open,
  busy,
  animationDuration,
  onKeepWorking,
  onOverwrite,
}: DesignerPublishConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onKeepWorking}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="publish-conflict-dialog-title"
      aria-describedby="publish-conflict-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle id="publish-conflict-dialog-title" sx={{pb: 0}}>
        Could not publish
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
          onClick={onKeepWorking}
          disabled={busy}
          autoFocus
          data-testid="web-designer-conflict-keep-working-button"
          sx={{textTransform: 'none', fontWeight: 700, color: 'text.secondary'}}
        >
          Keep working
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={onOverwrite}
          disabled={busy}
          data-testid="web-designer-conflict-overwrite-button"
          sx={{textTransform: 'none', fontWeight: 700}}
        >
          Overwrite live design
        </Button>
      </DialogActions>
    </Dialog>
  );
}
