/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: Reusable_Dialog.tsx
 * Description: ReusableDialog is a customizable dialog component that provides
 * a consistent layout for dialogs/popus across the application.
 */
import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Button,
  Divider,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type ReusableDialogProps = {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onPrimaryAction: () => void;
  primaryActionText: string;
  primaryActionLoading?: boolean;
  primaryActionColor?: 'primary' | 'secondary' | 'error';
  primaryActionVariant?: 'contained' | 'outlined';
  cancelButtonText?: string;
};

/**

 *
 * @param {boolean} open - Controls whether the dialog is open or closed.
 * @param {string} title - The title displayed at the top of the dialog.
 * @param {React.ReactNode} [icon] - Optional icon displayed above the title.
 * @param {React.ReactNode} children - The content of the dialog.
 * @param {Function} onClose - Callback function to handle the closing of the dialog.
 * @param {Function} onPrimaryAction - Callback function for the primary action button.
 * @param {string} primaryActionText - The text displayed on the primary action button.
 * @param {boolean} [primaryActionLoading=false] - Controls the loading state of the primary action button.
 * @param {'primary' | 'secondary' | 'error'} [primaryActionColor='primary'] - Color of the primary action button.
 * @param {'contained' | 'outlined'} [primaryActionVariant='contained'] - Variant of the primary action button.
 * @param {string} [cancelButtonText='Cancel'] - The text displayed on the cancel button.
 */

export default function ReusableDialog({
  open,
  title,
  icon,
  children,
  onClose,
  onPrimaryAction,
  primaryActionText,
  primaryActionLoading = false,
  primaryActionColor = 'primary',
  primaryActionVariant = 'contained',
  cancelButtonText = 'Cancel',
}: ReusableDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle style={{textAlign: 'center', paddingBottom: 0}}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
          mb={2}
        >
          {icon && <Box mb={1}>{icon}</Box>}
          <Typography
            variant="h4"
            style={{fontWeight: 'bold', textAlign: 'center'}}
          >
            {title}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          style={{position: 'absolute', top: 8, right: 8}}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>{children}</DialogContent>
      <DialogActions style={{justifyContent: 'space-between', padding: '8px'}}>
        <Button onClick={onClose} color="primary">
          {cancelButtonText}
        </Button>
        <Button
          variant={primaryActionVariant}
          color={primaryActionColor}
          onClick={onPrimaryAction}
          disabled={primaryActionLoading}
        >
          {primaryActionText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
