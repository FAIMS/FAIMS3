// SPDX-License-Identifier: Apache-2.0

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
} from '@mui/material';

type DesignerCloseDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onKeepEditing: () => void;
  onCloseKeepDraft: () => void;
  onDiscardDraft: () => void;
};

/**
 * Warn that close leaves an unpublished local draft (unless the user discards).
 */
export function DesignerCloseDraftDialog({
  open,
  animationDuration,
  onKeepEditing,
  onCloseKeepDraft,
  onDiscardDraft,
}: DesignerCloseDraftDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onKeepEditing}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="close-draft-dialog-title"
      aria-describedby="close-draft-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle id="close-draft-dialog-title">Unpublished draft</DialogTitle>
      <DialogContent>
        <DialogContentText id="close-draft-dialog-description">
          Your work is saved as a local unpublished draft in this browser.
          Closing keeps the draft so you can restore it later. Discarding
          removes the draft; the next time you open this editor you will see the
          published design.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={onKeepEditing}
          autoFocus
          data-testid="web-designer-keep-editing-button"
        >
          Keep editing
        </Button>
        <Button
          onClick={onCloseKeepDraft}
          color="inherit"
          data-testid="web-designer-close-keep-draft-button"
        >
          Close
        </Button>
        <Button
          onClick={onDiscardDraft}
          color="error"
          data-testid="web-designer-discard-draft-button"
        >
          Discard draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
