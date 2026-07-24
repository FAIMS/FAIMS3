/**
 * Canonical design-token contract shared by every designer theme variant.
 * Each theme file (faims-tokens.ts, bss-tokens.ts) must satisfy this type.
 */
export type DesignerThemeTokens = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  backgroundDefault: string;

  // ── Brand palette ────────────────────────────────────────────────────────
  primaryMain: string;
  primaryLight: string;
  primaryDark: string;
  primaryContrastText: string;
  secondaryMain: string;

  // ── Text ────────────────────────────────────────────────────────────────
  /** Muted helper / placeholder text colour */
  helperTextColor: string;

  // ── App bar ──────────────────────────────────────────────────────────────
  appBarBackground: string;
  appBarColor: string;

  // ── Form tabs (the folder-style SITE / BUILDING tabs) ────────────────────
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

  // ── Semantic actions ────────────────────────────────────────────────────
  errorMain: string;
  /** Colour used for destructive delete actions */
  deleteButtonColor: string;
  /** Success / positive-action green (checkboxes, Add buttons, completed steps) */
  successMain: string;
  /** Info palette main colour */
  infoMain: string;
  /** Colour used to distinguish AND operators in the condition editor */
  conditionAndMain: string;
  /** Colour used to distinguish OR operators in the condition editor */
  conditionOrMain: string;

  /** Fuzzy-search match emphasis in autocomplete option text */
  searchMatchHighlight: string;

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: string;
  midGrey: string;
  lightGrey: string;
};
