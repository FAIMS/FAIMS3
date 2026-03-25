import CloseIcon from '@mui/icons-material/Close';
import {Box, Dialog, DialogContent, IconButton} from '@mui/material';
import React from 'react';

/**
 * Shared full-screen lightbox for viewing a photo at full size.
 * Used by both the TakePhoto view-only renderer and the TakePhoto edit component.
 * Includes a floating close button (top-left) and click-outside-to-close.
 */
export const PhotoLightbox: React.FC<{url: string; onClose: () => void}> = ({
  url,
  onClose,
}) => {
  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      sx={{'& .MuiDialog-paper': {backgroundColor: 'rgba(0,0,0,0.92)'}}}
    >
      <DialogContent
        onClick={onClose}
        sx={{
          p: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          touchAction: 'manipulation',
          position: 'relative',
        }}
      >
        <IconButton
          aria-label="Close preview"
          size="large"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            position: 'absolute',
            top: 'max(56px, env(safe-area-inset-top, 0px) + 48px)',
            left: 16,
            zIndex: 1,
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.22)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            padding: 2,
            '& .MuiSvgIcon-root': {fontSize: 32},
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.32)',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          component="img"
          src={url}
          alt="Full size preview"
          onClick={e => e.stopPropagation()}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
