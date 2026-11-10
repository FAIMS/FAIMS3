// SPDX-License-Identifier: Apache-2.0

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {IconButton} from '@mui/material';

type DesignerDialogCloseButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  'data-testid': string;
};

export const designerDialogTitleWithCloseSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  pb: 0,
  pr: 1,
} as const;

/**
 * Corner X that exits a designer decision dialog without applying its actions.
 */
export function DesignerDialogCloseButton({
  onClick,
  disabled = false,
  'data-testid': testId,
}: DesignerDialogCloseButtonProps) {
  return (
    <IconButton
      aria-label="close"
      onClick={onClick}
      disabled={disabled}
      size="small"
      data-testid={testId}
      sx={{
        color: 'text.secondary',
        '&:hover': {color: 'text.primary'},
      }}
    >
      <CloseRoundedIcon />
    </IconButton>
  );
}
