// SPDX-License-Identifier: Apache-2.0
/**
 * MUI theme helpers for map control buttons.
 *
 * Mobile app themes define `palette.mapControl`; Control Centre and other hosts
 * may not — {@link MapControlThemeProvider} fills in defaults.
 */
import {mapControlBrand} from '@faims3/data-model';
import {
  createTheme,
  Theme,
  ThemeProvider,
  useTheme,
} from '@mui/material/styles';
import {ReactNode, useMemo} from 'react';

/** Default map control palette when the host app has no MUI `palette.mapControl`. */
export const defaultMapControlPalette = {
  groupBackground: 'rgba(255, 255, 255, 0.95)',
  groupShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  buttonBackground: '#171717',
  buttonBackgroundHover: '#323232',
  buttonActiveBackground: mapControlBrand.activeMain,
  buttonActiveBackgroundHover: mapControlBrand.activeHover,
  buttonForeground: '#FFFFFF',
  scrim: mapControlBrand.scrim,
  sheetShadow: mapControlBrand.sheetShadow,
  locationRing: mapControlBrand.locationRing,
} as const;

type MapControlPalette = Theme['palette']['mapControl'];

function hasCompleteMapControlPalette(
  palette: Partial<MapControlPalette> | undefined
): boolean {
  return Boolean(
    palette?.groupBackground &&
    palette.groupShadow &&
    palette.buttonBackground &&
    palette.buttonBackgroundHover &&
    palette.buttonActiveBackground &&
    palette.buttonActiveBackgroundHover &&
    palette.buttonForeground &&
    palette.scrim &&
    palette.sheetShadow &&
    palette.locationRing
  );
}

/**
 * Return `theme` unchanged when `palette.mapControl` is complete; otherwise merge
 * in {@link defaultMapControlPalette}, keeping any host overrides.
 */
export function ensureMapControlTheme(theme: Theme): Theme {
  const existing = theme.palette.mapControl as
    | Partial<MapControlPalette>
    | undefined;
  if (hasCompleteMapControlPalette(existing)) {
    return theme;
  }
  return createTheme(theme, {
    palette: {
      mapControl: {
        ...defaultMapControlPalette,
        ...(existing ?? {}),
      },
    },
  });
}

/** Supplies `palette.mapControl` when missing (e.g. web Control Centre without MUI theme). */
export function MapControlThemeProvider({children}: {children: ReactNode}) {
  const outerTheme = useTheme();
  const theme = useMemo(() => ensureMapControlTheme(outerTheme), [outerTheme]);

  if (theme === outerTheme) {
    return <>{children}</>;
  }

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
