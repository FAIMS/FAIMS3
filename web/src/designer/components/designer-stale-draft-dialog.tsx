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

type DesignerStaleDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onContinue: () => void;
  onDiscardAndLoadLive: () => void;
};

const STALE_DRAFT_COPY =
  'The live {notebook} design has been updated since this unpublished draft was created. Publishing will replace the live design with this draft.';

/**
 * Open-time warning when a local draft is based on an older published design.
 */
export function DesignerStaleDraftDialog({
  open,
  animationDuration,
  onContinue,
  onDiscardAndLoadLive,
}: DesignerStaleDraftDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onContinue}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="stale-draft-dialog-title"
      aria-describedby="stale-draft-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle id="stale-draft-dialog-title" sx={{pb: 0}}>
        Warning: this design has changed
      </DialogTitle>
      <DialogContent sx={{'&&': {pt: 1}}}>
        <DialogContentText id="stale-draft-dialog-description">
          {brandNotebook(STALE_DRAFT_COPY)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 2, pb: 2}}>
        <Button
          variant="outlined"
          color="primary"
          onClick={onContinue}
          autoFocus
          data-testid="web-designer-stale-continue-button"
          sx={{textTransform: 'none', fontWeight: 700}}
        >
          Continue with local draft
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onDiscardAndLoadLive}
          data-testid="web-designer-stale-load-live-button"
          sx={{textTransform: 'none', fontWeight: 700, color: 'text.secondary'}}
        >
          Discard draft and load latest version
        </Button>
      </DialogActions>
    </Dialog>
  );
}
