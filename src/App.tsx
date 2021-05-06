import React from 'react';
import './App.css';
import {FAIMSContainer} from './gui';

import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@material-ui/core';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5
import {Shadows} from '@material-ui/core/styles/shadows';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#1B3E93',
    },
    secondary: {
      main: '#F68E1E',
    },
  },
  typography: {
    fontFamily: "'Open Sans', sans-serif",
  },
  shadows: Array(25).fill('none') as Shadows,
});

function App() {
  return (
    <MuiThemeProvider theme={theme}>
      <FAIMSContainer />
    </MuiThemeProvider>
  );
}

export default App;
