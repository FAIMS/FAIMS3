/**
 * Canonical design-token contract shared by every designer theme variant.
 * Each theme file must satisfy this type.
 */
export type DesignerThemeTokens = {
  backgroundDefault: string;

  primaryMain: string;
  primaryLight: string;
  primaryDark: string;
  primaryContrastText: string;
  secondaryMain: string;

  /** Muted helper / placeholder text colour */
  helperTextColor: string;

  appBarBackground: string;
  appBarColor: string;
};
