// SPDX-License-Identifier: Apache-2.0

import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import {Box, ButtonBase} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {designerInfoCalloutSx} from './designer-style';

const BACKUP_HELPER =
  'Save a copy of your draft before switching or overwriting.';

type DesignerDraftBackupCalloutProps = {
  onDownload: () => void;
  disabled?: boolean;
  'data-testid': string;
};

/**
 * Full-width info callout that downloads the local designer draft as JSON.
 */
export function DesignerDraftBackupCallout({
  onDownload,
  disabled = false,
  'data-testid': testId,
}: DesignerDraftBackupCalloutProps) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onDownload}
      aria-label="Download backup"
      data-testid={testId}
      sx={[
        designerInfoCalloutSx,
        {
          mt: 2,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 1.5,
          width: '100%',
          px: 2,
          py: 1.5,
          textAlign: 'left',
          color: 'text.primary',
          backgroundColor: theme => alpha(theme.palette.info.main, 0.08),
          borderColor: theme => alpha(theme.palette.info.main, 0.28),
          '&:hover': {
            backgroundColor: theme => alpha(theme.palette.info.main, 0.14),
          },
          '&.Mui-disabled': {opacity: 0.65},
        },
      ]}
    >
      <FileDownloadRoundedIcon
        color="info"
        sx={{mt: 0.15, fontSize: '1.45rem'}}
      />
      <Box>
        <Box sx={{fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3}}>
          Download backup
        </Box>
        <Box
          sx={{
            mt: 0.4,
            color: 'text.secondary',
            fontSize: '0.875rem',
            lineHeight: 1.45,
          }}
        >
          {BACKUP_HELPER}
        </Box>
      </Box>
    </ButtonBase>
  );
}
