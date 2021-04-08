import React from 'react';
import './App.css';
import {FAIMSForm} from './gui/index';
import Navbar from './gui/navbar';
import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
import {Shadows} from '@material-ui/core/styles/shadows';
import Container from '@material-ui/core/Container';

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
      <Container maxWidth="sm">
        <FAIMSForm project="test" />
      </Container>
    </MuiThemeProvider>
  );
}

export default App;
