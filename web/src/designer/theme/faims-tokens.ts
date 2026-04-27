import {colors} from '@mui/material';
import type {DesignerThemeTokens} from './tokens';

/**
 * FAIMS default theme tokens.
 * Primary: green  |  Secondary / accent: orange
 */
export const faimsTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#FAFAFB',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: '#669911',
  primaryLight: '#a7e938',
  primaryDark: '#141E03',
  primaryContrastText: '#FFFFFF',
  secondaryMain: '#E18200',

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: '#edeeeb',
  appBarColor: '#324C08',
  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: '#E18200',
  formTabSelectedBg: '#DA9449',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: false, // FAIMS uses filled-tab style; no underline
  formTabIndicatorColor: '#E18200',
  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: '#D32F2F',
  deleteButtonColor: '#D32F2F',
  successMain: '#388E3C',
  tooltipIconColor: '#1976D2', // MUI info blue

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[700],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
