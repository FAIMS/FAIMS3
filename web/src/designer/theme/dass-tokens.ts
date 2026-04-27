import {colors} from '@mui/material';
import type {DesignerThemeTokens} from './tokens';

/**
 * DASS / BSS theme tokens.
 * Primary: black  |  Secondary / accent: maroon-red
 */
export const dassTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#FAFAFB',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: '#000000',
  primaryLight: '#4A4A4A',
  primaryDark: '#000000',
  primaryContrastText: '#FFFFFF',
  secondaryMain: '#C40000',

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.grey[600],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: '#FFFFFF',
  appBarColor: '#000000',
  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: '#C40000',
  formTabSelectedBg: '#4C1F24',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: '#C40000',
  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: '#C40000',
  deleteButtonColor: '#C40000',
  successMain: '#2E7D32',
  tooltipIconColor: '#1565C0',

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.grey[700],
  midGrey: colors.grey[500],
  lightGrey: colors.grey[200],
};
