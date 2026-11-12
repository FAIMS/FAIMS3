// SPDX-License-Identifier: Apache-2.0

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grow,
} from '@mui/material';
import type {SxProps, Theme} from '@mui/material/styles';
import type {ReactNode} from 'react';
import {DesignerDialogCloseButton} from './designer-dialog-close-button';
import {
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleWithCloseSx,
} from './designer-style';

type DesignerDecisionDialogProps = {
  open: boolean;
  animationDuration: number;
  titleId: string;
  descriptionId?: string;
  title: ReactNode;
  closeTestId: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  busy?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  actions: ReactNode;
  actionsSx?: SxProps<Theme>;
  titleSx?: SxProps<Theme>;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
};

/**
 * Shared Grow + titled-close chrome for designer confirm / conflict dialogs.
 */
export function DesignerDecisionDialog({
  open,
  animationDuration,
  titleId,
  descriptionId,
  title,
  closeTestId,
  closeLabel,
  closeDisabled = false,
  busy = false,
  onClose,
  children,
  actions,
  actionsSx,
  titleSx,
  maxWidth = 'sm',
}: DesignerDecisionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      slots={{transition: Grow}}
      transitionDuration={animationDuration}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
    >
      <DialogTitle
        id={titleId}
        sx={
          (titleSx
            ? [designerDialogTitleWithCloseSx, titleSx]
            : designerDialogTitleWithCloseSx) as SxProps<Theme>
        }
      >
        {title}
        <DesignerDialogCloseButton
          onClick={onClose ?? (() => undefined)}
          disabled={closeDisabled || busy}
          label={closeLabel}
          data-testid={closeTestId}
        />
      </DialogTitle>
      {children ? (
        <DialogContent sx={designerDialogContentSx}>{children}</DialogContent>
      ) : null}
      <DialogActions
        sx={
          (actionsSx
            ? [designerDialogActionsSx, actionsSx]
            : designerDialogActionsSx) as SxProps<Theme>
        }
      >
        {actions}
      </DialogActions>
    </Dialog>
  );
}
