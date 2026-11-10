// SPDX-License-Identifier: Apache-2.0

import {Typography} from '@mui/material';
import type {DesignerDraftStatus} from '../integration/useDesignerDraftSession';
import {designerDraftStatusCopy} from '../integration/useDesignerDraftSession';

type DesignerDraftStatusLabelProps = {
  status: DesignerDraftStatus;
  errorMessage?: string;
};

/**
 * Autosave status in the designer chrome. Visible on Design, Info, and Setup.
 */
export function DesignerDraftStatusLabel({
  status,
  errorMessage,
}: DesignerDraftStatusLabelProps) {
  return (
    <Typography
      component="span"
      variant="body2"
      data-testid="web-designer-draft-status"
      aria-live="polite"
      aria-atomic="true"
      sx={{
        color: status === 'error' ? 'error.main' : 'text.secondary',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {designerDraftStatusCopy(status, errorMessage)}
    </Typography>
  );
}
