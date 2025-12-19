/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: index.tsx
 * Description:
 *   TODO
 */

import {colors, createTheme} from '@mui/material';
import typography from './typography';

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
      draftBackground: '#FFFFFFFF',
      lightBackground: '#edeeeb',
      tabsBackground: '#edeeeb',
    },

    primary: {
      main: '#76b70eff',
      light: '#a7e938',
      dark: '#141E03',
    },

    success: {
      main: '#b6df71',
    },

    error: {
      main: '#D50C0CFF',
    },

    grey: {
      400: '#BDBDBD',
    },

    highlightColor: {
      main: '#E18200',
      contrastText: '#141E03',
    },
    secondary: {
      main: '#E18200',
      contrastText: '#E18200',
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
      helpText: colors.blueGrey[600],
    },
    alert: {
      warningBackground: '#FFF4E5',
      warningText: '#9C5711FF',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
      successBackground: '#669911',
    },
    dialogButton: {
      cancel: '#E18200',
      confirm: '#669911',
      dialogText: '#FFFFFF',
      hoverBackground: '#50790DFF',
    },
    progressBar: {
      background: '#edeeeb',
      complete: '#669911',
    },
    icon: {
      main: '#E18200',

      light: '#edeeeb',
      required: '#890808FF',
      highlight: '#B10000',
    },
    table: {
      divider: '#828789FF',
      rowBorder: '#D3D1D1FF',
      columnSeparator: '#828789FF',
    },
    // stepperGradient: generateStepperColors(10, 'default'),
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
          color: '#324C08', //tab text color
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
