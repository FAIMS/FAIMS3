/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React from 'react';

/** Colour key for the confirm button (mapped to MUI Button `color` prop). */
type ConfirmColor = 'primary' | 'error' | 'warning' | 'success';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Dialog title. */
  title: React.ReactNode;
  /** Body — any ReactNode (Typography, Stack, etc.). */
  children: React.ReactNode;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Confirm button label. Default: "Confirm". */
  confirmLabel?: string;
  /** Confirm button colour. Default: "error" for destructive actions. */
  confirmColor?: ConfirmColor;
  /** Show a loading state on Confirm and disable both buttons. */
  confirmLoading?: boolean;
  /** MUI dialog max width. Default: "xs". */
  maxWidth?: 'xs' | 'sm' | 'md';
}

/**
 * Shared confirmation dialog. Visual rule:
 *  - destructive action (confirm) sits on the LEFT (red contained)
 *  - safer "continue" action (cancel) sits on the RIGHT (primary contained,
 *    which renders as black on bssTheme)
 *  - title is centered and slightly larger
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmColor = 'error',
  confirmLoading = false,
  maxWidth = 'xs',
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={confirmLoading ? undefined : onClose}
      aria-labelledby="confirm-dialog-title"
      fullWidth
      maxWidth={maxWidth}
    >
      <DialogTitle
        id="confirm-dialog-title"
        sx={{textAlign: 'center', fontSize: '1.35rem', fontWeight: 600}}
      >
        {title}
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions sx={{justifyContent: 'space-between', px: 3, pb: 2}}>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disableElevation
          disabled={confirmLoading}
        >
          {confirmLabel}
        </Button>
        <Button
          onClick={onClose}
          color="primary"
          variant="contained"
          disableElevation
          disabled={confirmLoading}
        >
          {cancelLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
