/**
 * Shared brand colour constants.
 *
 * Single source of truth for brand-palette hex values used by both the main
 * app themes (app/src/gui/themes/) and the designer token files
 * (web/src/designer/theme/).  Change a colour once here; both pick it up.
 *
 * Values that intentionally differ between app and designer are NOT listed
 * here — each consumer defines those locally with a comment explaining why.
 *
 * Known intentional differences:
 *  - bssTheme app bar: app uses white (#FFFFFF), designer uses dark (#111111)
 *  - bssTheme secondary: app uses #12B0FB (nav accent), designer uses #C62828 (form accent)
 *  - bssTheme primary.light: app uses #FFFFFF, designer uses #424242
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
  primaryDark: '#000000',
  primaryContrastText: '#FFFFFF',
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

/** Active map control button (e.g. satellite toggle on) — shared across themes */
export const mapControlBrand = {
  activeMain: '#1a73e8',
  activeHover: '#1666cc',
} as const;
