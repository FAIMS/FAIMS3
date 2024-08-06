import defaultTheme from './default';
import csiroTheme from './csiro';
import defaultAppBarStyling, {
  Heading as defaultAppBarHeading,
  hideAppBarAuth as defaultHideAppBarAuth,
} from './default/appBar';
import csiroAppBarStyling, {
  Heading as csiroAppBarHeading,
  hideAppBarAuth as csiroHideAppBarAuth,
} from './csiro/appBar';

const export_theme = () => {
  const theme = import.meta.env.VITE_THEME;

  if (theme === 'csiro') {
    return csiroTheme;
  }

  return defaultTheme;
};

const export_appBar_styling = () => {
  const theme = import.meta.env.VITE_THEME;

  if (theme === 'csiro') {
    return csiroAppBarStyling;
  }

  return defaultAppBarStyling;
};

const export_appBar_heading = () => {
  const theme = import.meta.env.VITE_THEME;

  if (theme === 'csiro') {
    return csiroAppBarHeading;
  }

  return defaultAppBarHeading;
};

const export_hideAppBarAuth = () => {
  const theme = import.meta.env.VITE_THEME;

  if (theme === 'csiro') {
    return csiroHideAppBarAuth;
  }

  return defaultHideAppBarAuth;
};

export const theme = export_theme();
export const appBarStyling = export_appBar_styling();
export const AppBarHeading = export_appBar_heading();
export const hideAppBarAuth = export_hideAppBarAuth();
