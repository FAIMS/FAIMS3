import {colors, createTheme} from '@mui/material';
import typography from '../default/typography';

const primaryMainColor = '#000000';

const theme = createTheme({
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
      draftBackground: '#F4F4F4',
      lightBackground: '#f3f3f3',
      tabsBackground: '#F0F0F0FF',
    },
    primary: {
      main: primaryMainColor,
      light: '#FFFFFF',
      dark: '#000000',
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
      helpText: colors.blueGrey[600],
    },
    stepper: {
      current: '#000000',
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
  components: {
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
            backgroundColor: primaryMainColor,
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

export default theme;
