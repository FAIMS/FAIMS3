import React from 'react';
import './App.css';
import {FAIMSContainer} from './gui';
import Navbar from './gui/navbar';
import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
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
      <Navbar />
      <FAIMSContainer />
    </MuiThemeProvider>
  );
}

export default App;
