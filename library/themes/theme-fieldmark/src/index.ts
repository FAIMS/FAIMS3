import {colors, createTheme} from '@mui/material';
import {fieldmarkBrand} from './brand-colours';
import {
  DesignerThemeTokens,
  ThemeDefinition,
  buildSharedComponentOverrides,
  createAppBarStyling,
} from '@faims3/theme-base';

export {fieldmarkBrand} from './brand-colours';

const designerTokens: DesignerThemeTokens = {
  backgroundDefault: '#FAFAFB',
  primaryMain: fieldmarkBrand.primaryMain,
  primaryLight: fieldmarkBrand.primaryLight,
  primaryDark: fieldmarkBrand.primaryDark,
  primaryContrastText: fieldmarkBrand.primaryContrastText,
  secondaryMain: fieldmarkBrand.secondaryMain,
  helperTextColor: colors.blueGrey[500],
  appBarBackground: fieldmarkBrand.appBarBackground,
  appBarColor: fieldmarkBrand.appBarForeground,
  formTabBorderColor: fieldmarkBrand.secondaryMain,
  formTabSelectedBg: fieldmarkBrand.primaryMain,
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: fieldmarkBrand.secondaryMain,
  errorMain: fieldmarkBrand.errorMain,
  deleteButtonColor: fieldmarkBrand.errorMain,
  successMain: fieldmarkBrand.successMain,
  infoMain: fieldmarkBrand.infoMain,
  darkGrey: colors.blueGrey[700],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};

const typography = {
  fontFamily: "'Open Sans', sans-serif",
  h1: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 35,
    letterSpacing: '-0.24px',
  },
  h2: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 29,
    letterSpacing: '-0.24px',
  },
  h3: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 24,
    letterSpacing: '-0.06px',
  },
  h4: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 20,
    letterSpacing: '-0.06px',
  },
  h5: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 16,
    letterSpacing: '-0.05px',
  },
  h6: {
    fontFamily: "'Lato', sans-serif",
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: '-0.05px',
  },
  overline: {
    fontWeight: 500,
  },
  subtitle2: {
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.66,
  },
};

const baseTheme = createTheme({
  stepperColors: {
    current: '#000000',
    visited: '#07a907',
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
  },
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#FFFFFFFF',
      lightBackground: '#edeeeb',
      tabsBackground: '#edeeeb',
    },
    primary: {
      main: fieldmarkBrand.primaryMain,
      light: fieldmarkBrand.primaryLight,
      dark: fieldmarkBrand.primaryDark,
    },
    stepper: {
      current: fieldmarkBrand.secondaryMain,
      visited: fieldmarkBrand.primaryMain,
      error: '#D50C0CFF',
      notVisited: '#B7C1A6F1',
    },
    highlightColor: {
      main: fieldmarkBrand.secondaryMain,
      contrastText: fieldmarkBrand.primaryDark,
    },
    secondary: {
      main: fieldmarkBrand.secondaryMain,
      contrastText: fieldmarkBrand.secondaryMain,
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
      helpText: colors.blueGrey[600],
    },
    alert: {
      warningBackground: '#FFF4E5',
      warningText: '#9C5711FF',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
      successBackground: fieldmarkBrand.primaryMain,
    },
    dialogButton: {
      cancel: fieldmarkBrand.secondaryMain,
      confirm: fieldmarkBrand.primaryMain,
      dialogText: '#FFFFFF',
      hoverBackground: '#50790DFF',
    },
    progressBar: {
      background: fieldmarkBrand.appBarBackground,
      complete: fieldmarkBrand.primaryMain,
    },
    icon: {
      main: fieldmarkBrand.secondaryMain,
      light: fieldmarkBrand.appBarBackground,
      required: '#890808FF',
      highlight: '#B10000',
    },
    table: {
      divider: '#828789FF',
      rowBorder: '#D3D1D1FF',
      columnSeparator: '#828789FF',
    },
  },
  typography,
});

const muiTheme = createTheme(baseTheme, {
  components: {
    ...buildSharedComponentOverrides(baseTheme),
    MuiAppBar: {
      styleOverrides: {
        root: {
          '&.MuiAppBar-root': {
            boxShadow: 'none',
          },
        },
        colorPrimary: {
          backgroundColor: fieldmarkBrand.appBarBackground,
          color: fieldmarkBrand.appBarForeground,
          contrastText: '#fff',
          textColor: '#fff',
          indicatorColor: '#fff',
          text: {
            primary: '#fff',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '&.MuiTabs-root': {
            boxShadow: 'none',
            fontWeight: 'bold',
          },
          '&.MuiTab-root': {
            fontWeight: '700 !important',
          },
          '&.Mui-selected': {
            fontWeight: '700 !important',
            color: 'white',
            backgroundColor: '#DA9449',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&.MuiTab-root': {
            fontWeight: 'bold',
          },
        },
      },
    },
  },
});

export const themeFieldmarkDefinition: ThemeDefinition = {
  id: 'fieldmark',
  app: {
    muiTheme,
    appBarStyling: createAppBarStyling(),
    appBarHeading: 'fieldmark',
    projectListLayout: 'table',
    projectListVerbose: true,
  },
  web: {
    className: 'theme-default',
    designerTokens,
  },
};
