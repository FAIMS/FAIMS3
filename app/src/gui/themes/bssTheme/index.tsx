import {createTheme} from '@mui/material';
import typography from '../default/typography';

const primaryMainColor = '#000000';

const theme = createTheme({
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#F4F4F4',
    },
    primary: {
      main: primaryMainColor,
      light: 'white',
    },
    highlightColor: {
      main: '#D10202',
    },
    secondary: {
      main: '#197A01',
      contrastText: '#000000',
    },
    text: {
      primary: '#000000FF',
      secondary: '#000000',
      // helpicon and other icons : '#12B0FB',
      // second primary : '#197A01',
      // required field: #D10202,
      // survey card bg: #F4F4F4,
      // chip bg : #8B8B8B,
    },
    alert: {
      warningBackground: '#FFFFFF',
      warningText: '#5F370E',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
    },
    dailogButton: {
      cancel: '#606060',
      confirm: '#BC0505',
      confirmText: '#FFFFFF',
    },
    progressBar: {
      background: '#edeeeb',
      complete: '#EA6216',
    },
    icon: {
      main: '#12B0FB',
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
            backgroundColor: '#35CFCFFF',
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
