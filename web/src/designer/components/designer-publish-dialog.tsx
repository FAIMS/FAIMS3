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
import type {DesignerDocumentMode} from '../state/initial';

export type DesignerPublishIntent = 'stay' | 'close';

type DesignerPublishDialogProps = {
  open: boolean;
  mode: DesignerDocumentMode;
  intent: DesignerPublishIntent | null;
  busy: boolean;
  animationDuration: number;
  onCancel: () => void;
  onConfirm: () => void;
};

const PROJECT_PUBLISH_COPY =
  'Publishing replaces the live survey design. Field users will receive this design on their next sync. Collected records can become inconsistent if the response shape changed.';

const TEMPLATE_PUBLISH_COPY =
  'Publishing updates this template only. Existing projects created from it are not rewritten.';

/**
 * Confirm that a designer publish is a live write (project vs template copy).
 */
export function DesignerPublishDialog({
  open,
  mode,
  intent,
  busy,
  animationDuration,
  onCancel,
  onConfirm,
}: DesignerPublishDialogProps) {
  const confirmLabel =
    intent === 'close' ? 'Publish and close' : 'Publish changes';

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby="publish-dialog-title"
      aria-describedby="publish-dialog-description"
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle id="publish-dialog-title">Publish changes?</DialogTitle>
      <DialogContent>
        <DialogContentText id="publish-dialog-description">
          {mode === 'template' ? TEMPLATE_PUBLISH_COPY : PROJECT_PUBLISH_COPY}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          disabled={busy}
          data-testid="web-designer-publish-cancel-button"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy}
          data-testid="web-designer-publish-confirm-button"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
