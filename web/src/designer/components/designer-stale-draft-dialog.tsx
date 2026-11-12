// SPDX-License-Identifier: Apache-2.0

import {brandNotebook} from '@/constants';
import {Box, Button, DialogContentText} from '@mui/material';
import {DesignerDecisionDialog} from './designer-decision-dialog';
import {DesignerDraftBackupCallout} from './designer-draft-backup-callout';
import {designerCancelButtonSx, designerDialogButtonSx} from './designer-style';

type DesignerStaleDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onDismiss: () => void;
  onSwitchToLatest: () => void;
  onWorkOnMyVersion: () => void;
  onDownloadBackup: () => void;
};

const STALE_INTRO =
  "Another user has published a new version of the {notebook} while you're working on your draft. You can:";

const STALE_OPTIONS = [
  'Continue work on your draft.',
  'Discard your draft and work on the latest version.',
] as const;

const STALE_BACKUP =
  "If you'd like to save a backup of your draft, you can download it below.";

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
    <DesignerDecisionDialog
      open={open}
      animationDuration={animationDuration}
      titleId="stale-draft-dialog-title"
      descriptionId="stale-draft-dialog-description"
      title="Warning: This design has changed."
      closeTestId="web-designer-stale-dismiss-button"
      closeLabel="Cancel"
      onClose={onDismiss}
      titleSx={{gap: 4}}
      actionsSx={{justifyContent: 'flex-end'}}
      actions={
        <>
          <Button
            variant="outlined"
            color="warning"
            onClick={onWorkOnMyVersion}
            data-testid="web-designer-stale-continue-button"
            sx={designerDialogButtonSx}
          >
            Work on my version
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onSwitchToLatest}
            autoFocus
            data-testid="web-designer-stale-load-live-button"
            sx={designerCancelButtonSx}
          >
            Discard draft & edit latest version
          </Button>
        </>
      }
    >
      <DialogContentText id="stale-draft-dialog-description" component="div">
        <Box>{brandNotebook(STALE_INTRO)}</Box>
        <Box
          component="ol"
          sx={{mt: 1, mb: 0, pl: 3.5, listStyleType: 'decimal'}}
        >
          {STALE_OPTIONS.map(option => (
            <li key={option}>{option}</li>
          ))}
        </Box>
        <Box sx={{mt: 2}}>{STALE_BACKUP}</Box>
      </DialogContentText>
      <DesignerDraftBackupCallout
        onDownload={onDownloadBackup}
        data-testid="web-designer-stale-download-backup-button"
      />
    </DesignerDecisionDialog>
  );
}
