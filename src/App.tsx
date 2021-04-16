import React from 'react';
import './App.css';
import {FAIMSContainer} from './gui';
import Navbar from './gui/navbar';
import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
import {Shadows} from '@material-ui/core/styles/shadows';
import * as Sync from './sync/index';

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
  const [listings, setListings] = React.useState('');

  Sync.initializeEvents.on('complete', (...args) => {
    setListings(JSON.stringify(args));
  });

  return (
    <MuiThemeProvider theme={theme}>
      <Navbar />
      <FAIMSContainer />
    </MuiThemeProvider>
  );
}

export default App;
