import {resolveAppThemeConfig} from '@faims3/theme-registry';

const appTheme = resolveAppThemeConfig(import.meta.env.VITE_THEME);

export const theme = appTheme.muiTheme;
export const appBarStyling = appTheme.appBarStyling;
export const projectListLayout = appTheme.projectListLayout;
export const projectListVerbose = appTheme.projectListVerbose;
export const appBarHeading = appTheme.appBarHeading;
