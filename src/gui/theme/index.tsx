import {createMuiTheme, colors} from '@material-ui/core';
import {Shadows} from '@material-ui/core/styles/shadows';
import typography from './typography';
import shadows from './shadows';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#1B3E93',
    },
    secondary: {
      // main: '#F68E1E',
      main: colors.indigo[500],
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
    },
  },
  shadows: shadows as Shadows,
  typography,
  // shadows: Array(25).fill('none') as Shadows,
});

export default theme;
