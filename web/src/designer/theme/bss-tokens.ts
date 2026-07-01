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
  primaryLight: '#424242',
  primaryDark: bssBrand.primaryDark,
  primaryContrastText: bssBrand.primaryContrastText,
  secondaryMain: '#B71C1C', // maroon form-action accent; app nav uses #12B0FB

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: '#111111', // designer uses dark bar; app uses white
  appBarColor: '#FFFFFF',

  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: '#B71C1C',
  formTabSelectedBg: '#B71C1C',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: '#B71C1C',

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: bssBrand.errorMain,
  deleteButtonColor: bssBrand.errorMain,
  successMain: bssBrand.successMain,
  infoMain: bssBrand.infoMain,
  // Primary is black in BSS; use the designer maroon accent for vivid contrast.
  searchMatchHighlight: '#B71C1C',

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[800],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
