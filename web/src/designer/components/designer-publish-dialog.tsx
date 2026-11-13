// SPDX-License-Identifier: Apache-2.0

import {brandNotebook} from '@/constants';
import {Alert, Box, Button, DialogContentText} from '@mui/material';
import {DesignerDecisionDialog} from './designer-decision-dialog';
import {designerCancelButtonSx, designerDialogButtonSx} from './designer-style';
import type {DesignerDocumentMode} from '../state/initial';

type DesignerPublishDialogProps = {
  open: boolean;
  mode: DesignerDocumentMode;
  busy: boolean;
  animationDuration: number;
  /** Collected records for this notebook. Templates omit this. */
  existingRecordCount?: number;
  /** Local draft is based on an older live design. */
  stale?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const PROJECT_PUBLISH_COPY =
  'Publishing these changes updates the live {notebook}. Users will receive this {notebook} when they reopen or refresh the app.';

const TEMPLATE_PUBLISH_COPY =
  'Publishing updates this template only. Existing {notebooks} created from it are not rewritten.';

const EXISTING_RECORDS_LOSS_COPY =
  'Changing the {notebook} design could result in the loss of this data.';

const STALE_DRAFT_PUBLISH_COPY =
  'Warning: the design has changed since this draft was created. Publishing will replace the current version.';

function recordsCountLabel(count: number): string {
  return count === 1 ? '1 record' : `${count} records`;
}

/**
 * Confirm that a designer publish is a live write (notebook vs template copy).
 * The existing-records warning is notebook-only and hidden when none exist.
 */
export function DesignerPublishDialog({
  open,
  mode,
  busy,
  animationDuration,
  existingRecordCount,
  stale = false,
  onCancel,
  onConfirm,
}: DesignerPublishDialogProps) {
  const recordCount = existingRecordCount ?? 0;
  const showExistingRecordsWarning = mode !== 'template' && recordCount > 0;

  return (
    <DesignerDecisionDialog
      open={open}
      animationDuration={animationDuration}
      titleId="publish-dialog-title"
      descriptionId="publish-dialog-description"
      title="Are you sure you want to publish these changes?"
      closeTestId="web-designer-publish-dismiss-button"
      closeDisabled={busy}
      busy={busy}
      onClose={onCancel}
      actions={
        <>
          <Button
            onClick={onCancel}
            disabled={busy}
            data-testid="web-designer-publish-cancel-button"
            sx={designerCancelButtonSx}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={busy}
            data-testid="web-designer-publish-confirm-button"
            sx={designerDialogButtonSx}
          >
            Publish changes
          </Button>
        </>
      }
    >
      {showExistingRecordsWarning ? (
        <Alert
          severity="warning"
          sx={{mb: 2}}
          data-testid="web-designer-publish-records-warning"
        >
          <Box>
            {brandNotebook(
              `Users have collected data in this {notebook} (${recordsCountLabel(recordCount)}).`
            )}
          </Box>
          <Box sx={{mt: 0.75}}>{brandNotebook(EXISTING_RECORDS_LOSS_COPY)}</Box>
        </Alert>
      ) : null}
      <DialogContentText id="publish-dialog-description">
        {brandNotebook(
          mode === 'template' ? TEMPLATE_PUBLISH_COPY : PROJECT_PUBLISH_COPY
        )}
        {stale ? ` ${STALE_DRAFT_PUBLISH_COPY}` : null}
      </DialogContentText>
    </DesignerDecisionDialog>
  );
}
