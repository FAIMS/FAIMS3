// SPDX-License-Identifier: Apache-2.0

import {Button} from '@mui/material';
import {DesignerDecisionDialog} from './designer-decision-dialog';
import {designerCancelButtonSx, designerDialogButtonSx} from './designer-style';

type DesignerCloseDraftDialogProps = {
  open: boolean;
  animationDuration: number;
  onPublishNow: () => void;
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
  onPublishNow,
  onKeepEditing,
  onCloseKeepDraft,
  onDiscardDraft,
}: DesignerCloseDraftDialogProps) {
  return (
    <DesignerDecisionDialog
      open={open}
      animationDuration={animationDuration}
      titleId="close-draft-dialog-title"
      title="You have unsaved changes."
      closeTestId="web-designer-close-draft-dismiss-button"
      onClose={onKeepEditing}
      actions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={onPublishNow}
            data-testid="web-designer-close-publish-now-button"
            sx={designerDialogButtonSx}
          >
            Publish changes
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onCloseKeepDraft}
            data-testid="web-designer-close-keep-draft-button"
            sx={designerCancelButtonSx}
          >
            Save draft & exit
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={onDiscardDraft}
            data-testid="web-designer-discard-draft-button"
            sx={designerDialogButtonSx}
          >
            Discard & exit
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onKeepEditing}
            autoFocus
            data-testid="web-designer-keep-editing-button"
            sx={designerCancelButtonSx}
          >
            Cancel
          </Button>
        </>
      }
    />
  );
}
