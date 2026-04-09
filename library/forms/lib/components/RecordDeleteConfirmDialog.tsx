/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';

export type RecordDeleteConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Human-readable HR ID for the record being deleted (shown in bold). */
  recordHrid: string;
  onConfirm: () => void;
  /** Shown above the main copy when present (e.g. permission or API errors). */
  errorMessage?: string | null;
  /** Disables actions and shows a spinner on Delete while the delete runs. */
  confirmLoading?: boolean;
};

/**
 * Shared confirmation UI for deleting a record: acknowledgement checkbox and
 * consistent copy for the app record view and related-record delete flows.
 */
export function RecordDeleteConfirmDialog({
  open,
  onClose,
  recordHrid,
  onConfirm,
  errorMessage,
  confirmLoading = false,
}: RecordDeleteConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open]);

  const deleteEnabled = acknowledged && !confirmLoading;

  return (
    <Dialog
      open={open}
      onClose={confirmLoading ? undefined : onClose}
      aria-labelledby="record-delete-dialog-title"
      aria-describedby="record-delete-dialog-description"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="record-delete-dialog-title">Delete record</DialogTitle>
      <DialogContent>
        <Stack spacing={2} id="record-delete-dialog-description">
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          <Typography variant="body2">
            Are you sure you want to delete this record? This action cannot be
            undone.
          </Typography>
          <Typography variant="body2" component="div">
            Record you will delete:{' '}
            <Box component="span" fontWeight="bold">
              {recordHrid}
            </Box>
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={(_, checked) => setAcknowledged(checked)}
                disabled={confirmLoading}
              />
            }
            label="I understand this cannot be undone."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{justifyContent: 'space-between', px: 3, pb: 2}}>
        <Button onClick={onClose} color="primary" disabled={confirmLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disableElevation
          disabled={!deleteEnabled}
          data-testid="confirm-delete"
          startIcon={
            confirmLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : undefined
          }
        >
          {confirmLoading ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
