import CloseIcon from '@mui/icons-material/Close';
import {Box, Dialog, DialogContent, IconButton} from '@mui/material';
import React, {useCallback, useRef, useState} from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
/** Movement under this many pixels is treated as a tap, not a pan. */
const TAP_MOVE_THRESHOLD_PX = 6;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/**
 * Full-screen photo lightbox.
 *
 * Interactions:
 *  - Pinch-to-zoom on mobile.
 *  - Mouse wheel to zoom on desktop.
 *  - Double-click / double-tap to reset zoom.
 *  - Click outside the image (when not zoomed) to close.
 *  - Click the X button (positioned below the app bar) to close.
 *
 * Used by TakePhoto (edit + view renderers) and the advanced helper image
 * viewer in FieldWrapper.
 */
export const PhotoLightbox: React.FC<{
  url: string;
  onClose: () => void;
}> = ({url, onClose}) => {
  const [scale, setScale] = useState(MIN_SCALE);

  // Tracked during a gesture so we don't re-render on every touch frame.
  const pinchDistRef = useRef<number | null>(null);
  const movedDistanceRef = useRef(0);

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
  }, []);

  // Mouse-wheel zoom (desktop).
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setScale(s => clamp(s * delta, MIN_SCALE, MAX_SCALE));
  }, []);

  // Pinch to zoom (two fingers).
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    movedDistanceRef.current = 0;
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      // Two fingers: scale by how much the distance between them changed.
      const [a, b] = [e.touches[0], e.touches[1]];
      const newDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = newDist / pinchDistRef.current;
      pinchDistRef.current = newDist;
      // A pinch is never a tap — make sure the background click handler ignores it.
      movedDistanceRef.current = Number.POSITIVE_INFINITY;
      setScale(s => clamp(s * ratio, MIN_SCALE, MAX_SCALE));
      e.preventDefault();
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    pinchDistRef.current = null;
  }, []);

  // Click on the dark area: reset zoom if zoomed, otherwise close.
  const onBackgroundClick = useCallback(() => {
    if (movedDistanceRef.current > TAP_MOVE_THRESHOLD_PX) {
      // The user was pinching — ignore the click that comes with the gesture end.
      return;
    }
    if (scale > MIN_SCALE) {
      reset();
    } else {
      onClose();
    }
  }, [scale, onClose, reset]);

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
        onClick={onBackgroundClick}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        sx={{
          p: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          // Stop the browser's own gestures so our pinch handler works.
          touchAction: 'none',
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
        <Box
          component="img"
          src={url}
          alt="Full size preview"
          onClick={e => e.stopPropagation()}
          onDoubleClick={reset}
          draggable={false}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: scale === MIN_SCALE ? 'transform 200ms ease' : 'none',
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
