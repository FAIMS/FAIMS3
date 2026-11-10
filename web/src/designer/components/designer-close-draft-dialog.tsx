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

type DesignerCloseDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onPublishNow: () => void;
  onKeepEditing: () => void;
  onCloseKeepDraft: () => void;
  onDiscardDraft: () => void;
};

const CLOSE_DRAFT_COPY =
  'You have unpublished changes. You can publish them now, discard them, or keep them as an unpublished draft (you can safely open this {notebook} again, on this device, and finish your work).';

const closeDraftButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
} as const;

const closeDraftNeutralButtonSx = {
  ...closeDraftButtonSx,
  color: 'text.secondary',
} as const;

/**
 * Warn that close leaves an unpublished local draft (unless the user discards).
 */
export function DesignerCloseDraftDialog({
  open,
  animationDuration,
  onPublishNow,
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
      <DialogTitle
        id="close-draft-dialog-title"
        sx={designerDialogTitleWithCloseSx}
      >
        Unpublished draft
        <DesignerDialogCloseButton
          onClick={onKeepEditing}
          data-testid="web-designer-close-draft-dismiss-button"
        />
      </DialogTitle>
      <DialogContent sx={{'&&': {pt: 1}}}>
        <DialogContentText id="close-draft-dialog-description">
          {brandNotebook(CLOSE_DRAFT_COPY)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap', gap: 1, px: 2, pb: 2}}>
        <Button
          variant="outlined"
          color="primary"
          onClick={onPublishNow}
          data-testid="web-designer-close-publish-now-button"
          sx={closeDraftButtonSx}
        >
          Publish now
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCloseKeepDraft}
          data-testid="web-designer-close-keep-draft-button"
          sx={closeDraftNeutralButtonSx}
        >
          Close and keep draft
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onKeepEditing}
          autoFocus
          data-testid="web-designer-keep-editing-button"
          sx={closeDraftNeutralButtonSx}
        >
          Keep working
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={onDiscardDraft}
          data-testid="web-designer-discard-draft-button"
          sx={closeDraftButtonSx}
        >
          Close and discard draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
