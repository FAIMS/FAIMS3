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
  formTabBorderColor: '#E18200',
  formTabSelectedBg: '#DA9449',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: false,
  formTabIndicatorColor: '#E18200',
  errorMain: '#D32F2F',
  deleteButtonColor: '#D32F2F',
  tooltipIconColor: '#1976D2',
  darkGrey: colors.blueGrey[700],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};
