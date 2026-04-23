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

  /** Border colour for unselected form tabs */
  formTabBorderColor: string;
  /** Background of the selected / active form tab */
  formTabSelectedBg: string;
  /** Text colour of the selected form tab */
  formTabSelectedText: string;
  /** Whether the MUI underline indicator should be visible */
  formTabIndicatorVisible: boolean;
  /** Colour of the MUI underline indicator when visible */
  formTabIndicatorColor: string;
};
