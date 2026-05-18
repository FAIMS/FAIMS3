import {colors} from '@mui/material';
import type {DesignerThemeTokens} from './tokens';

/**
 * BSS / DASS theme tokens.
 * Primary: black/charcoal | Secondary/accent: red.
 */
export const bssTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#F7F7F8',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: '#1A1A1A',
  primaryLight: '#424242',
  primaryDark: '#000000',
  primaryContrastText: '#FFFFFF',
  secondaryMain: '#C62828',

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: '#111111',
  appBarColor: '#FFFFFF',

  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: '#C62828',
  formTabSelectedBg: '#C62828',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: '#C62828',

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: '#D32F2F',
  deleteButtonColor: '#D32F2F',
  successMain: '#2E7D32',
  infoMain: '#1565C0',

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[800],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
