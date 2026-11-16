// SPDX-License-Identifier: Apache-2.0

import {brandNotebook} from '@/constants';
import {Box, Button, DialogContentText} from '@mui/material';
import {DesignerDecisionDialog} from './designer-decision-dialog';
import {DesignerDraftBackupCallout} from './designer-draft-backup-callout';
import {designerCancelButtonSx, designerDialogButtonSx} from './designer-style';

type DesignerPublishConflictDialogProps = {
  open: boolean;
  busy: boolean;
  animationDuration: number;
  onDismiss: () => void;
  onSwitchToLatest: () => void;
  onForcePublish: () => void;
  onDownloadBackup: () => void;
};

const CONFLICT_INTRO =
  'The {notebook} has been updated since you created your draft. You can:';

const CONFLICT_OPTIONS = [
  'Discard your draft and work on the latest version.',
  "Forcefully publish your version, overwriting other users' changes.",
] as const;

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
    <DesignerDecisionDialog
      open={open}
      animationDuration={animationDuration}
      titleId="publish-conflict-dialog-title"
      descriptionId="publish-conflict-dialog-description"
      title="Could not publish: another user has made changes"
      closeTestId="web-designer-conflict-dismiss-button"
      closeLabel="Cancel"
      busy={busy}
      onClose={onDismiss}
      titleSx={{gap: 4}}
      actionsSx={{justifyContent: 'flex-end'}}
      actions={
        <>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onSwitchToLatest}
            disabled={busy}
            autoFocus
            data-testid="web-designer-conflict-switch-latest-button"
            sx={designerCancelButtonSx}
          >
            Switch to latest version
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={onForcePublish}
            disabled={busy}
            data-testid="web-designer-conflict-overwrite-button"
            sx={designerDialogButtonSx}
          >
            Forcefully publish
          </Button>
        </>
      }
    >
      <DialogContentText
        id="publish-conflict-dialog-description"
        component="div"
      >
        <Box>{brandNotebook(CONFLICT_INTRO)}</Box>
        <Box
          component="ol"
          sx={{mt: 1, mb: 0, pl: 3.5, listStyleType: 'decimal'}}
        >
          {CONFLICT_OPTIONS.map(option => (
            <li key={option}>{option}</li>
          ))}
        </Box>
      </DialogContentText>
      <DesignerDraftBackupCallout
        onDownload={onDownloadBackup}
        disabled={busy}
        data-testid="web-designer-conflict-download-backup-button"
      />
    </DesignerDecisionDialog>
  );
}
