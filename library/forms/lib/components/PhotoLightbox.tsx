/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {Box} from '@mui/material';
import React, {useRef} from 'react';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';
import {MediaLightbox} from './MediaLightbox';

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
 * Used by TakePhoto (edit + view), Sketch view mode, and the advanced helper
 * image viewer in FieldWrapper. The shared chrome lives in {@link MediaLightbox}.
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
    <MediaLightbox
      onClose={onClose}
      closeOnBackdrop
      onBackdropClick={handleBackgroundClick}
      closeAriaLabel="Close preview"
      contentSx={{
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{flex: 1, minHeight: 0, width: '100%', height: '100%'}}>
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
      </Box>
    </MediaLightbox>
  );
};
