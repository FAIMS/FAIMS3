import {colors, createTheme} from '@mui/material';
import {bssBrand} from './brand-colours';
import {
  DesignerThemeTokens,
  ThemeDefinition,
  buildSharedComponentOverrides,
  createAppBarStyling,
} from '@faims3/theme-base';

export {bssBrand} from './brand-colours';

const designerTokens: DesignerThemeTokens = {
  backgroundDefault: '#F7F7F8',
  primaryMain: bssBrand.primaryMain,
  primaryLight: '#424242',
  primaryDark: bssBrand.primaryDark,
  primaryContrastText: bssBrand.primaryContrastText,
  secondaryMain: '#B71C1C',
  helperTextColor: colors.blueGrey[500],
  appBarBackground: '#111111',
  appBarColor: '#FFFFFF',
  formTabBorderColor: '#B71C1C',
  formTabSelectedBg: '#B71C1C',
  formTabSelectedText: '#FFFFFF',
  formTabIndicatorVisible: true,
  formTabIndicatorColor: '#B71C1C',
  errorMain: bssBrand.errorMain,
  deleteButtonColor: bssBrand.errorMain,
  successMain: bssBrand.successMain,
  infoMain: bssBrand.infoMain,
  darkGrey: colors.blueGrey[800],
  midGrey: colors.blueGrey[500],
  lightGrey: colors.blueGrey[100],
};

const typography = {
  fontFamily: "'Inter', sans-serif",
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
    current: bssBrand.primaryMain,
    visited: '#07a907',
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
  },
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#F4F4F4',
      lightBackground: '#f3f3f3',
      tabsBackground: '#F0F0F0FF',
    },
    primary: {
      main: bssBrand.primaryMain,
      light: '#FFFFFF',
      dark: bssBrand.primaryDark,
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
      helpText: colors.blueGrey[600],
    },
    stepper: {
      current: bssBrand.primaryMain,
      visited: '#07a907',
      error: '#EE1616FF',
      notVisited: '#BDBDBD',
    },
    highlightColor: {
      main: '#B10000',
      contrastText: '#F4F4F4',
    },
    secondary: {
      main: '#12B0FB',
      contrastText: '#F4F4F4',
    },
    success: {
      main: bssBrand.successMain,
      contrastText: '#FFFFFF',
    },
    alert: {
      warningBackground: '#FFFFFF',
      warningText: '#EA0E0EFF',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
      successBackground: '#197A01',
    },
    dialogButton: {
      cancel: '#606060',
      confirm: '#B10000',
      dialogText: '#FFFFFF',
      hoverBackground: '#711111FF',
    },
    progressBar: {
      background: '#edeeeb',
      complete: '#EA6216',
    },
    icon: {
      main: '#197A01',
      light: '#EAEAEA',
      required: '#5E0000',
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
          backgroundColor: '#FFFFFF',
          color: '#000000FF',
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
            backgroundColor: '#FFFFFF',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 'bold',
          color: '#000000',
          '&.Mui-selected': {
            color: '#FFFFFF',
            backgroundColor: bssBrand.primaryMain,
            fontWeight: '700',
          },
          '&:not(.Mui-selected)': {
            color: '#000000',
          },
        },
      },
    },
  },
});

export const themeBssDefinition: ThemeDefinition = {
  id: 'bssTheme',
  app: {
    muiTheme,
    appBarStyling: createAppBarStyling(),
    appBarHeading: 'bssTheme',
    projectListLayout: 'card-list',
    projectListVerbose: true,
  },
  web: {
    className: 'theme-bss',
    designerTokens,
  },
};
