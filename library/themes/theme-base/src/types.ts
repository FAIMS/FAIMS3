import {Theme} from '@mui/material/styles';

export const SUPPORTED_THEME_IDS = [
  'default',
  'fieldmark',
  'bssTheme',
] as const;

export type ThemeId = (typeof SUPPORTED_THEME_IDS)[number];

export type ProjectListLayout = 'table' | 'card-list';

export interface StepperColors {
  current: string;
  visited: string;
  error: string;
  notVisited: string;
}

export interface DesignerThemeTokens {
  backgroundDefault: string;
  primaryMain: string;
  primaryLight: string;
  primaryDark: string;
  primaryContrastText: string;
  secondaryMain: string;
  helperTextColor: string;
  appBarBackground: string;
  appBarColor: string;
  formTabBorderColor: string;
  formTabSelectedBg: string;
  formTabSelectedText: string;
  formTabIndicatorVisible: boolean;
  formTabIndicatorColor: string;
  errorMain: string;
  deleteButtonColor: string;
  successMain: string;
  infoMain: string;
  darkGrey: string;
  midGrey: string;
  lightGrey: string;
}

export interface AppThemeConfig {
  muiTheme: Theme;
  appBarStyling: unknown;
  appBarHeading: string;
  projectListLayout: ProjectListLayout;
  projectListVerbose: boolean;
}

export interface WebThemeConfig {
  className: string;
  designerTokens: DesignerThemeTokens;
}

export interface ThemeDefinition {
  id: ThemeId;
  app: AppThemeConfig;
  web: WebThemeConfig;
}
