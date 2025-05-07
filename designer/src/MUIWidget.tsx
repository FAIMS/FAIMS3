// /Users/ryankontos/FAIMS3/designer/src/MUIWidget.tsx

import {Provider as ReduxProvider} from 'react-redux'; // your RTK store
import {ThemeProvider, CssBaseline} from '@mui/material';
import {MemoryRouter} from 'react-router-dom';

import App from './App'; // your existing MUI+Router app
import {store} from '../src/state/store'; // your configureStore
import theme from './theme'; // your MUI theme

/**
 * MUIWidget
 *
 * A self-contained widget that brings in:
 *  • your Redux store (with undo/persist),
 *  • your MUI theme (CssBaseline + theme),
 *  • a MemoryRouter so it won’t clash with your host’s Router,
 *  • and finally renders your App.
 */
export default function MUIWidget() {
  return (
    <ReduxProvider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </ReduxProvider>
  );
}

export {default as MUIWidget} from './MUIWidget';
