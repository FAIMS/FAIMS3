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
import type {DesignerDocumentMode} from '../state/initial';

export type DesignerPublishIntent = 'stay' | 'close';

type DesignerPublishDialogProps = {
  open: boolean;
  mode: DesignerDocumentMode;
  intent: DesignerPublishIntent | null;
  busy: boolean;
  animationDuration: number;
  /** Collected records for this survey. Templates and empty surveys omit this. */
  existingRecordCount?: number;
  /** Local draft is based on an older live design. */
  stale?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const PROJECT_PUBLISH_COPY =
  'Publishing replaces the live survey design. Field users will receive this design on their next sync.';

const TEMPLATE_PUBLISH_COPY =
  'Publishing updates this template only. Existing projects created from it are not rewritten.';

const EXISTING_RECORDS_PUBLISH_COPY =
  'This {notebook} has existing records. Changing the {notebook} design could result in the loss of existing data.';

const STALE_DRAFT_PUBLISH_COPY =
  'Warning: the design has changed since this draft was created. Publishing will replace the current version.';

/**
 * Confirm that a designer publish is a live write (project vs template copy).
 * The existing-records warning is survey-only and hidden when none exist.
 */
export function DesignerPublishDialog({
  open,
  mode,
  intent,
  busy,
  animationDuration,
  existingRecordCount,
  stale = false,
  onCancel,
  onConfirm,
}: DesignerPublishDialogProps) {
  const confirmLabel =
    intent === 'close' ? 'Publish and close' : 'Publish changes';
  const showExistingRecordsWarning =
    mode !== 'template' && (existingRecordCount ?? 0) > 0;

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
      <DialogTitle id="publish-dialog-title" sx={designerDialogTitleWithCloseSx}>
        Publish changes?
        <DesignerDialogCloseButton
          onClick={onCancel}
          disabled={busy}
          data-testid="web-designer-publish-dismiss-button"
        />
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="publish-dialog-description">
          {mode === 'template' ? TEMPLATE_PUBLISH_COPY : PROJECT_PUBLISH_COPY}
          {showExistingRecordsWarning
            ? ` ${brandNotebook(EXISTING_RECORDS_PUBLISH_COPY)}`
            : null}
          {stale ? ` ${STALE_DRAFT_PUBLISH_COPY}` : null}
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
