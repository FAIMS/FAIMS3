/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import CloseIcon from '@mui/icons-material/Close';
import {Box, Dialog, DialogContent, IconButton} from '@mui/material';
import type {SxProps, Theme} from '@mui/material/styles';
import React from 'react';

export type MediaLightboxProps = {
  onClose: () => void;
  children: React.ReactNode;
  /** Extra controls on the top-right (Save, etc.). Close stays top-left. */
  actions?: React.ReactNode;
  /**
   * If true, clicking the dark/empty area around children closes the lightbox.
   * Disable for editors so a missed stroke does not dismiss the canvas.
   */
  closeOnBackdrop?: boolean;
  /** Override the default backdrop-click handler (e.g. ignore clicks after a pan). */
  onBackdropClick?: () => void;
  paperSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  closeAriaLabel?: string;
  /** Show the default close button. Default true. */
  showCloseButton?: boolean;
};

/**
 * Full-screen lightbox shell shared by photo preview and the sketch editor.
 *
 * Photo viewing adds pinch-zoom inside {@link PhotoLightbox}; the sketch
 * editor fills the same chrome with a toolbar + canvas.
 */
export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  onClose,
  children,
  actions,
  closeOnBackdrop = false,
  onBackdropClick,
  paperSx,
  contentSx,
  closeAriaLabel = 'Close',
  showCloseButton = true,
}) => {
  const handleBackdropClick = () => {
    if (onBackdropClick) {
      onBackdropClick();
      return;
    }
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={false}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: 'rgba(0,0,0,0.92)',
          ...((paperSx as object) ?? {}),
        },
      }}
    >
      <DialogContent
        onClick={
          closeOnBackdrop || onBackdropClick ? handleBackdropClick : undefined
        }
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: '100%',
          touchAction: 'manipulation',
          ...((contentSx as object) ?? {}),
        }}
      >
        {showCloseButton && (
          <IconButton
            aria-label={closeAriaLabel}
            size="large"
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            sx={{
              position: 'absolute',
              top: 'max(56px, env(safe-area-inset-top, 0px) + 48px)',
              left: 16,
              zIndex: 3,
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.22)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              padding: 2,
              '& .MuiSvgIcon-root': {
                fontSize: 32,
              },
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.32)',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
        {actions && (
          <Box
            onClick={e => e.stopPropagation()}
            sx={{
              position: 'absolute',
              top: 'max(56px, env(safe-area-inset-top, 0px) + 48px)',
              right: 16,
              zIndex: 3,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            {actions}
          </Box>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
};
