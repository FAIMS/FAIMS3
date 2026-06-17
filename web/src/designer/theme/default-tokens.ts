import {colors} from '@mui/material';
import {defaultBrand} from '@faims3/data-model';
import type {DesignerThemeTokens} from './tokens';

/**
 * Default theme tokens.
 * Primary: blue (#223883)  |  Secondary / accent: teal (#b5d3d5)
 * Brand palette values come from @faims3/data-model brand-colours.ts
 */
export const defaultTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#FAFAFB',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: defaultBrand.primaryMain,
  primaryLight: defaultBrand.primaryLight,
  primaryDark: defaultBrand.primaryDark,
  primaryContrastText: defaultBrand.primaryContrastText,
  secondaryMain: defaultBrand.secondaryMain,

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: defaultBrand.appBarBackground,
  appBarColor: defaultBrand.appBarForeground,

  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: defaultBrand.primaryMain,
  formTabSelectedBg: defaultBrand.primaryMain,
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: defaultBrand.secondaryMain,

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: defaultBrand.errorMain,
  deleteButtonColor: defaultBrand.errorMain,
  successMain: defaultBrand.successMain,
  infoMain: defaultBrand.infoMain,

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[800],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
