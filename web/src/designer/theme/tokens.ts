/**
 * Canonical design-token contract shared by every designer theme variant.
 * Each theme file (faims-tokens.ts, dass-tokens.ts) must satisfy this type.
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
  /** Colour for info-tooltip icons */
  tooltipIconColor: string;

  // ── Neutral greyscale ───────────────────────────────────────────────────
  darkGrey: string;
  midGrey: string;
  lightGrey: string;
};
