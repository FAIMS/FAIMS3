// SPDX-License-Identifier: Apache-2.0
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import {Box, Typography} from '@mui/material';
import {SxProps, Theme} from '@mui/material/styles';
import React, {useEffect, useState} from 'react';

/** Tile layout for a broken image, non-image attachment, or similar placeholder. */
export const attachmentPreviewPlaceholderSx = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  p: 1,
  bgcolor: 'grey.100',
  color: 'text.secondary',
  cursor: 'default',
} as const;

/**
 * Inert tile used when an attachment cannot be shown as an image.
 */
export const AttachmentPreviewPlaceholder: React.FC<{
  icon: React.ReactNode;
  children?: React.ReactNode;
  'data-testid'?: string;
  sx?: Exclude<SxProps<Theme>, ReadonlyArray<unknown>>;
}> = ({icon, children, 'data-testid': testId, sx}) => (
  <Box
    data-testid={testId}
    sx={[attachmentPreviewPlaceholderSx, ...(sx === undefined ? [] : [sx])]}
  >
    {icon}
    {children}
  </Box>
);

/**
 * `<img>` that swaps to an inert placeholder when the browser cannot
 * decode the bytes (wrong extension, corrupt raster, SVG labelled as PNG).
 *
 * Used by TakePhoto, FileUploader, and PhotoLightbox so a failed load never
 * shows the browser's broken-image glyph.
 */
export const ImageWithFallback: React.FC<{
  src: string;
  alt: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  role?: React.AriaRole;
  tabIndex?: number;
  draggable?: boolean;
  sx?: SxProps<Theme>;
  /** Caption under the icon. Pass an empty string to hide it. */
  fallbackLabel?: string;
  /** Merged onto the placeholder Box (lightbox colours and spacing). */
  fallbackSx?: Exclude<SxProps<Theme>, ReadonlyArray<unknown>>;
  /** Typography variant for {@link fallbackLabel}. */
  fallbackTypographyVariant?: 'caption' | 'body2';
}> = ({
  src,
  alt,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  draggable,
  sx,
  fallbackLabel = 'Image preview not available',
  fallbackSx,
  fallbackTypographyVariant = 'caption',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    // Fill the parent tile when the caller set width/height 100% (TakePhoto
    // gallery, FileUploader thumbs). No intrinsic min size: view-mode photos
    // have no parent box, so the placeholder shrinks to the icon + caption.
    return (
      <AttachmentPreviewPlaceholder
        data-testid="broken-image-thumbnail"
        icon={<BrokenImageIcon fontSize="large" />}
        sx={fallbackSx}
      >
        {fallbackLabel ? (
          <Typography
            variant={fallbackTypographyVariant}
            sx={{color: 'inherit', textAlign: 'center'}}
          >
            {fallbackLabel}
          </Typography>
        ) : null}
      </AttachmentPreviewPlaceholder>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      role={role}
      tabIndex={tabIndex}
      draggable={draggable}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onError={event => {
        // Ignore stale errors from a previous `src` (revoked blob URL).
        if (event.currentTarget.getAttribute('src') === src) {
          setFailed(true);
        }
      }}
      sx={sx}
    />
  );
};
