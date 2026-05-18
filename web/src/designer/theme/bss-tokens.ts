import {colors} from '@mui/material';
import {bssBrand} from '@faims3/data-model';
import type {DesignerThemeTokens} from './tokens';

/**
 * BSS theme tokens.
 * Primary: black  |  Secondary / accent: red (form-action accent in designer;
 * the app uses #12B0FB blue for nav — different semantic use, not shared).
 * Brand palette values come from @faims3/data-model brand-colours.ts
 */
export const bssTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#F7F7F8',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: bssBrand.primaryMain,
  primaryLight: bssBrand.primaryLight,
  primaryDark: bssBrand.primaryDark,
  primaryContrastText: bssBrand.primaryContrastText,
  secondaryMain: '#C62828', // red form-action accent; app nav uses #12B0FB

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: bssBrand.appBarBackground,
  appBarColor: bssBrand.appBarForeground,

  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: '#C62828',
  formTabSelectedBg: '#C62828',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: '#C62828',

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: bssBrand.errorMain,
  deleteButtonColor: bssBrand.errorMain,
  successMain: bssBrand.successMain,
  infoMain: bssBrand.infoMain,

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[800],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
