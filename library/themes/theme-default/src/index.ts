import {colors, createTheme} from '@mui/material';
import {defaultBrand} from './brand-colours';
import {
  DesignerThemeTokens,
  ThemeDefinition,
  buildSharedComponentOverrides,
  createAppBarStyling,
} from '@faims3/theme-base';

export {defaultBrand} from './brand-colours';

const designerTokens: DesignerThemeTokens = {
  backgroundDefault: '#FAFAFB',
  primaryMain: defaultBrand.primaryMain,
  primaryLight: defaultBrand.primaryLight,
  primaryDark: defaultBrand.primaryDark,
  primaryContrastText: defaultBrand.primaryContrastText,
  secondaryMain: defaultBrand.secondaryMain,
  helperTextColor: colors.blueGrey[500],
  appBarBackground: defaultBrand.appBarBackground,
  appBarColor: defaultBrand.appBarForeground,
  formTabBorderColor: defaultBrand.primaryMain,
  formTabSelectedBg: defaultBrand.primaryMain,
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: defaultBrand.secondaryMain,
  errorMain: defaultBrand.errorMain,
  deleteButtonColor: defaultBrand.errorMain,
  successMain: defaultBrand.successMain,
  infoMain: defaultBrand.infoMain,
  darkGrey: colors.blueGrey[800],
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
    visited: defaultBrand.primaryMain,
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
  },
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#FFFFFFFF',
      lightBackground: '#E8EAF0',
      tabsBackground: '#E8EAF0',
    },
    primary: {
      main: defaultBrand.primaryMain,
      light: defaultBrand.primaryLight,
      dark: defaultBrand.primaryDark,
    },
    stepper: {
      current: defaultBrand.secondaryMain,
      visited: defaultBrand.primaryMain,
      error: '#D50C0CFF',
      notVisited: '#A8B0C8',
    },
    highlightColor: {
      main: defaultBrand.secondaryMain,
      contrastText: defaultBrand.primaryDark,
    },
    secondary: {
      main: defaultBrand.secondaryMain,
      contrastText: defaultBrand.secondaryMain,
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
      successBackground: defaultBrand.primaryMain,
    },
    dialogButton: {
      cancel: defaultBrand.secondaryMain,
      confirm: defaultBrand.primaryMain,
      dialogText: '#FFFFFF',
      hoverBackground: '#1A2C68',
    },
    progressBar: {
      background: defaultBrand.appBarBackground,
      complete: defaultBrand.primaryMain,
    },
    icon: {
      main: defaultBrand.secondaryMain,
      light: defaultBrand.appBarBackground,
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
          backgroundColor: defaultBrand.appBarBackground,
          color: defaultBrand.appBarForeground,
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
            backgroundColor: '#b5d3d5',
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

export const themeDefaultDefinition: ThemeDefinition = {
  id: 'default',
  app: {
    muiTheme,
    appBarStyling: createAppBarStyling(),
    appBarHeading: 'default',
    projectListLayout: 'table',
    projectListVerbose: true,
  },
  web: {
    className: 'theme-default',
    designerTokens,
  },
};
