/**
 * Shared brand colour constants.
 *
 * These are the single source of truth for brand-palette hex values used by
 * both the main app themes (app/src/gui/themes/) and the designer token files
 * (web/src/designer/theme/). 
 * PLEASE NOTE:  Keep colour values here; do not duplicate them.
 *
 * NOTE on secondary colour for bssTheme:
 *   The app uses #12B0FB (light blue) as MUI secondary for nav / tab accents.
 *   The designer uses #C62828 (red) as MUI secondary for form-action accents.
 *   These serve different semantic purposes so they are NOT shared here; each
 *   consumer defines its own secondary.
 */

export const fieldmarkBrand = {
  primaryMain: '#669911',
  primaryLight: '#a7e938',
  primaryDark: '#141E03',
  primaryContrastText: '#FFFFFF',
  secondaryMain: '#E18200',
  appBarBackground: '#edeeeb',
  appBarForeground: '#324C08',
  errorMain: '#D32F2F',
  successMain: '#388E3C',
  infoMain: '#1976D2',
} as const;

export const bssBrand = {
  primaryMain: '#000000',
  primaryLight: '#424242',
  primaryDark: '#000000',
  primaryContrastText: '#FFFFFF',
  appBarBackground: '#111111',
  appBarForeground: '#FFFFFF',
  errorMain: '#D32F2F',
  successMain: '#2E7D32',
  infoMain: '#1565C0',
} as const;

export const defaultBrand = {
  primaryMain: '#223883',
  primaryLight: '#4A6BC5',
  primaryDark: '#141E4A',
  primaryContrastText: '#FFFFFF',
  secondaryMain: '#b5d3d5',
  appBarBackground: '#E8EAF0',
  appBarForeground: '#141E4A',
  errorMain: '#D32F2F',
  successMain: '#388E3C',
  infoMain: '#1976D2',
} as const;
