import CloseIcon from '@mui/icons-material/Close';
import {Dialog, DialogContent, IconButton} from '@mui/material';
import {Box} from '@mui/material';
import React, {useRef} from 'react';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';

/**
 * Full-screen photo lightbox.
 *
 * Zoom / pan / pinch behaviour is delegated to react-zoom-pan-pinch — that
 * gives us battle-tested cross-platform handling (touch, pointer, wheel)
 * without us maintaining the per-platform quirks ourselves.
 *
 * Interactions:
 *  - Pinch to zoom on mobile, mouse wheel to zoom on desktop.
 *  - Drag (touch or mouse) to pan when zoomed in.
 *  - Double-tap / double-click to reset.
 *  - Tap the dark area outside the image to close (suppressed during a pan
 *    so we don't close right after the user lifts their finger).
 *  - Tap the X (visible below the app bar) to close.
 *
 * Used by TakePhoto (edit + view) and the advanced helper image viewer in
 * FieldWrapper.
 */
export const PhotoLightbox: React.FC<{
  url: string;
  onClose: () => void;
}> = ({url, onClose}) => {
  // Set by the library when a pan gesture starts. The click event that
  // fires when the user releases their finger should not close the dialog,
  // so the next click is swallowed and the flag is cleared.
  const justPannedRef = useRef(false);

  const handleBackgroundClick = () => {
    if (justPannedRef.current) {
      justPannedRef.current = false;
      return;
    }
    onClose();
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
        },
      }}
    >
      <DialogContent
        onClick={handleBackgroundClick}
        sx={{
          p: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          // The library owns touch handling on its own surface; outside of
          // it (the dark margins) we just want a clean tap-to-close.
          touchAction: 'manipulation',
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
            // Sit above the transform wrapper so it stays tappable when zoomed.
            zIndex: 2,
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
        <TransformWrapper
          minScale={1}
          maxScale={5}
          initialScale={1}
          centerOnInit
          wheel={{step: 0.08}}
          doubleClick={{mode: 'reset'}}
          onPanningStart={() => {
            justPannedRef.current = true;
          }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={url}
              alt="Full size preview"
              draggable={false}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                userSelect: 'none',
              }}
            />
          </TransformComponent>
        </TransformWrapper>
      </DialogContent>
    </Dialog>
  );
};
