import {createTheme, colors} from '@mui/material';
import typography from '../default/typography';

//BSS theme color values - @todo Tested by Ranisa
const theme = createTheme({
  palette: {
    background: {
      default: 'white',
    },
    primary: {
      main: 'black',
      light: '#B10000',
      dark: '#141E03',
    },
    secondary: {
      main: '#12B0FB',
      contrastText: '#B10000',
    },
    text: {
      //@todo ranisa to udate these as per new elements
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
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
          backgroundColor: '#edeeeb',
          color: '#324C08',
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

export default theme;
