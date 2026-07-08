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
} as const;

/**
 * Return `theme` unchanged when `palette.mapControl` is present; otherwise merge
 * in {@link defaultMapControlPalette}.
 */
export function ensureMapControlTheme(theme: Theme): Theme {
  if (theme.palette.mapControl?.groupShadow) {
    return theme;
  }
  return createTheme(theme, {
    palette: {
      mapControl: defaultMapControlPalette,
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
