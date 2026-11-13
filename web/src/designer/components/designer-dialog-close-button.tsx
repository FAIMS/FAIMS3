// SPDX-License-Identifier: Apache-2.0

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {Button, IconButton} from '@mui/material';
import {designerOverlayCloseButtonSx} from './designer-style';

type DesignerDialogCloseButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Optional text shown before the close icon (e.g. "Cancel"). */
  label?: string;
  'data-testid': string;
};

/**
 * Corner X that exits a designer decision dialog without applying its actions.
 */
export function DesignerDialogCloseButton({
  onClick,
  disabled = false,
  label,
  'data-testid': testId,
}: DesignerDialogCloseButtonProps) {
  if (label) {
    return (
      <Button
        variant="text"
        color="inherit"
        onClick={onClick}
        disabled={disabled}
        size="medium"
        endIcon={<CloseRoundedIcon fontSize="medium" />}
        data-testid={testId}
        sx={
          {
            ...designerOverlayCloseButtonSx,
            flexShrink: 0,
            px: 1.75,
            py: 0.75,
          } as typeof designerOverlayCloseButtonSx
        }
      >
        {label}
      </Button>
    );
  }

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
