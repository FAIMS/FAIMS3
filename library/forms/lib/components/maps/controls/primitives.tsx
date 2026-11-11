// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: primitives.tsx
 * Description:
 *   Layout and button primitives for map controls. Controls are ordinary
 *   React components rendered in a flex overlay above the OpenLayers canvas
 *   (rather than `ol/control` DOM controls), so spacing, theming and state
 *   all follow normal React/MUI patterns and adapt to any map size.
 */

import {Box, ButtonBase} from '@mui/material';
import {Theme} from '@mui/material/styles';
import {ReactNode} from 'react';

/** Spacing between control groups / overlay edge padding (theme spacing units) */
const OVERLAY_GAP = {xs: 1, sm: 1.5};

/** Per-side overlay padding, optionally grown to clear device safe areas. */
function overlayEdgePadding(theme: Theme, insetSafeArea: boolean | undefined) {
  if (!insetSafeArea) {
    return {p: OVERLAY_GAP};
  }
  const xs = theme.spacing(OVERLAY_GAP.xs);
  const sm = theme.spacing(OVERLAY_GAP.sm);
  const side = (inset: string) => ({
    xs: `max(${xs}, env(${inset}, 0px))`,
    sm: `max(${sm}, env(${inset}, 0px))`,
  });
  return {
    pt: side('safe-area-inset-top'),
    pr: side('safe-area-inset-right'),
    // Bottom stays at the regular gap: the map attribution strip below
    // the canvas owns the home-indicator inset.
    pb: OVERLAY_GAP,
    pl: side('safe-area-inset-left'),
  };
}

/**
 * Full-bleed overlay rendered above the map canvas. Lays out control slots
 * with flexbox so controls keep consistent spacing at any resolution:
 *
 * - `topContent`: stretches across the top, to the left of `topRight`
 *   (used e.g. for instruction banners).
 * - `topRight`: a vertical stack of control groups in the top-right corner.
 * - `bottomRight`: content aligned to the bottom-right corner (row,
 *   bottom-aligned).
 *
 * The overlay itself ignores pointer events; interactive children
 * (control groups) re-enable them, so map gestures work everywhere else.
 */
export const MapControlsOverlay = ({
  topContent,
  topRight,
  bottomRight,
  insetSafeArea,
}: {
  topContent?: ReactNode;
  topRight?: ReactNode;
  bottomRight?: ReactNode;
  /** Grow edge padding to clear notches / home indicators (full-screen map). */
  insetSafeArea?: boolean;
}) => (
  <Box
    sx={theme => ({
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      ...overlayEdgePadding(theme, insetSafeArea),
      gap: OVERLAY_GAP,
    })}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: OVERLAY_GAP,
        minHeight: 0,
      }}
    >
      <Box sx={{flex: 1, minWidth: 0}}>{topContent}</Box>
      {topRight && <MapControlStack>{topRight}</MapControlStack>}
    </Box>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: OVERLAY_GAP,
      }}
    >
      {bottomRight}
    </Box>
  </Box>
);

/** Vertical stack of control groups with consistent spacing. */
export const MapControlStack = ({children}: {children: ReactNode}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: OVERLAY_GAP,
      pointerEvents: 'none',
      minHeight: 0,
    }}
  >
    {children}
  </Box>
);

/** Rounded container holding one or more control buttons. */
export const MapControlGroup = ({children}: {children: ReactNode}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      backgroundColor: 'mapControl.groupBackground',
      borderRadius: '10px',
      p: 1,
      boxShadow: theme =>
        theme.palette.mapControl?.groupShadow ?? '0 1px 4px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'auto',
    }}
  >
    {children}
  </Box>
);

export interface MapControlButtonProps {
  /** Accessible label, also used as the hover tooltip */
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** Highlights the button when that control is the active mode */
  active?: boolean;
  children: ReactNode;
}

/** A single square map control button with consistent styling. */
export const MapControlButton = ({
  title,
  onClick,
  disabled,
  active,
  children,
}: MapControlButtonProps) => (
  <ButtonBase
    focusRipple
    onClick={onClick}
    disabled={disabled}
    aria-label={title}
    title={title}
    sx={{
      width: 35,
      height: 35,
      borderRadius: '8px',
      '& .MuiSvgIcon-root': {fontSize: 21},
      backgroundColor: active
        ? 'mapControl.buttonActiveBackground'
        : 'mapControl.buttonBackground',
      color: 'mapControl.buttonForeground',
      transition: 'opacity 0.2s, background-color 0.2s',
      '&:hover': {
        backgroundColor: active
          ? 'mapControl.buttonActiveBackgroundHover'
          : 'mapControl.buttonBackgroundHover',
      },
      '&.Mui-disabled': {
        opacity: 0.5,
        color: 'mapControl.buttonForeground',
      },
    }}
  >
    {children}
  </ButtonBase>
);

/** Renders an SVG asset (imported as a URL) as a control button icon. */
export const MapControlIcon = ({src, alt}: {src: string; alt: string}) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    sx={{width: 21, height: 21, display: 'block'}}
  />
);
