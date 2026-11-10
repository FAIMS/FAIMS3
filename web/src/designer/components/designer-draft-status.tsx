// SPDX-License-Identifier: Apache-2.0

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {CircularProgress, Stack, Typography} from '@mui/material';
import type {DesignerDraftStatus} from '../integration/useDesignerDraftSession';
import {designerDraftStatusCopy} from '../integration/useDesignerDraftSession';

type DesignerDraftStatusLabelProps = {
  status: DesignerDraftStatus;
  errorMessage?: string;
};

function DraftStatusIcon({status}: {status: DesignerDraftStatus}) {
  if (status === 'saving') {
    return (
      <CircularProgress
        size={16}
        thickness={5}
        aria-hidden
        data-testid="web-designer-draft-status-saving-icon"
        sx={{color: 'text.secondary'}}
      />
    );
  }
  if (status === 'error') {
    return (
      <ErrorOutlineRoundedIcon
        aria-hidden
        data-testid="web-designer-draft-status-error-icon"
        sx={{fontSize: 18, color: 'error.main'}}
      />
    );
  }
  return (
    <CheckCircleRoundedIcon
      aria-hidden
      data-testid="web-designer-draft-status-saved-icon"
      sx={{fontSize: 18, color: 'success.main'}}
    />
  );
}

/**
 * Autosave status in the editor toolbar, after Preview. Visible on Design, Info, and Setup.
 */
export function DesignerDraftStatusLabel({
  status,
  errorMessage,
}: DesignerDraftStatusLabelProps) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      data-testid="web-designer-draft-status"
      aria-live="polite"
      aria-atomic="true"
      sx={{alignItems: 'center', flexShrink: 0}}
    >
      <DraftStatusIcon status={status} />
      <Typography
        component="span"
        variant="body2"
        sx={{
          color: status === 'error' ? 'error.main' : 'text.secondary',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {designerDraftStatusCopy(status, errorMessage)}
      </Typography>
    </Stack>
  );
}
