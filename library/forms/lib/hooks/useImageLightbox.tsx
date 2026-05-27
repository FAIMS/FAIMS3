
/**
 * @file useImageLightbox.tsx
 * @description Reusable hook that adds click-to-zoom behaviour to any
 * container holding `<img>` elements (e.g. rendered markdown).
 *
 * Usage:
 * ```tsx
 * const {onContentClick, lightbox} = useImageLightbox();
 *
 * <DialogContent
 *   onClick={onContentClick}
 *   sx={{'& img': {cursor: 'zoom-in'}}}
 * >
 *   <RichTextContent content={...} />
 * </DialogContent>
 * {lightbox}
 * ```
 *
 * Inside the lightbox, clicking the image toggles between fit-to-screen
 * and natural pixel size. Close via the X button or ESC.
 */
import CloseIcon from '@mui/icons-material/Close';
import {Box, Dialog, IconButton} from '@mui/material';
import React, {useState} from 'react';

export interface UseImageLightboxReturn {
  /**
   * Click handler to attach to the container holding the images. Uses event
   * delegation — opens the lightbox when an `<img>` descendant is clicked.
   */
  onContentClick: (e: React.MouseEvent<HTMLElement>) => void;
  /** Rendered lightbox dialog. Drop into your tree once; renders nothing when closed. */
  lightbox: React.ReactElement;
}

/**
 * @returns Helpers to wire up image zoom on any container.
 */
export function useImageLightbox(): UseImageLightboxReturn {
  const [src, setSrc] = useState<string | null>(null);
  const [zoomedIn, setZoomedIn] = useState(false);

  const onContentClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setSrc((target as HTMLImageElement).src);
      setZoomedIn(false);
    }
  };

  const close = () => setSrc(null);

  const lightbox = (
    <Dialog
      open={src !== null}
      onClose={close}
      fullScreen
      aria-label="Image zoom"
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(0,0,0,0.92)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <IconButton
        aria-label="Close zoom"
        onClick={close}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 1,
          '&:hover': {backgroundColor: 'rgba(0,0,0,0.65)'},
        }}
      >
        <CloseIcon />
      </IconButton>
      <Box
        onClick={() => setZoomedIn(z => !z)}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: zoomedIn ? 'flex-start' : 'center',
          justifyContent: zoomedIn ? 'flex-start' : 'center',
          overflow: zoomedIn ? 'auto' : 'hidden',
          cursor: zoomedIn ? 'zoom-out' : 'zoom-in',
          p: zoomedIn ? 0 : 2,
        }}
      >
        {src && (
          <Box
            component="img"
            src={src}
            alt=""
            sx={{
              display: 'block',
              maxWidth: zoomedIn ? 'none' : '100%',
              maxHeight: zoomedIn ? 'none' : '100%',
              userSelect: 'none',
            }}
          />
        )}
      </Box>
    </Dialog>
  );

  return {onContentClick, lightbox};
}
