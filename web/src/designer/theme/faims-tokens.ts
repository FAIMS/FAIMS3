// SPDX-License-Identifier: Apache-2.0
import {colors} from '@mui/material';
import {fieldmarkBrand} from '@faims3/data-model';
import type {DesignerThemeTokens} from './tokens';

/**
 * FAIMS / Fieldmark theme tokens.
 * Primary: green  |  Secondary / accent: orange
 * Brand palette values come from @faims3/data-model brand-colours.ts
 */
export const faimsTokens: DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: '#FAFAFB',

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: fieldmarkBrand.primaryMain,
  primaryLight: fieldmarkBrand.primaryLight,
  primaryDark: fieldmarkBrand.primaryDark,
  primaryContrastText: fieldmarkBrand.primaryContrastText,
  secondaryMain: fieldmarkBrand.secondaryMain,

  // ── Text ────────────────────────────────────────────────────────────────
  helperTextColor: colors.blueGrey[500],

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: fieldmarkBrand.appBarBackground,
  appBarColor: fieldmarkBrand.appBarForeground,

  // ── Form tabs ────────────────────────────────────────────────────────────
  formTabBorderColor: fieldmarkBrand.secondaryMain,
  formTabSelectedBg: fieldmarkBrand.primaryMain,
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: fieldmarkBrand.secondaryMain, // orange underline on selected tab

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: fieldmarkBrand.errorMain,
  deleteButtonColor: fieldmarkBrand.errorMain,
  successMain: fieldmarkBrand.successMain,
  infoMain: fieldmarkBrand.infoMain,
  conditionAndMain: colors.cyan[700],
  conditionOrMain: colors.deepPurple[700],
  searchMatchHighlight: fieldmarkBrand.primaryMain,

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: colors.blueGrey[700],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],

  // ── Outlined input appearance ───────────────────────────────────────────
  outlinedInputSurface: '#FFFFFF',
  outlinedInputWash: colors.lightGreen[100],
  outlinedInputBorder: colors.blueGrey[700],
  outlinedInputHoverBorder: colors.blueGrey[800],
  outlinedInputFocusBorder: fieldmarkBrand.primaryDark,
  outlinedInputFocusRing: colors.blueGrey[800],

  // ── Expression chips ────────────────────────────────────────────────────
  chipWashNeutral: colors.blueGrey[600],
  chipWashParent: colors.blueGrey[800],
};
