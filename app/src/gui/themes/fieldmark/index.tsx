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
import {fieldmarkBrand} from '@faims3/data-model';
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
      main: fieldmarkBrand.primaryMain,
      light: fieldmarkBrand.primaryLight,
      dark: fieldmarkBrand.primaryDark,
    },

    stepper: {
      current: fieldmarkBrand.secondaryMain,
      visited: fieldmarkBrand.primaryMain,
      error: '#D50C0CFF',
      notVisited: '#B7C1A6F1',
    },
    highlightColor: {
      main: fieldmarkBrand.secondaryMain,
      contrastText: fieldmarkBrand.primaryDark,
    },
    secondary: {
      main: fieldmarkBrand.secondaryMain,
      contrastText: fieldmarkBrand.secondaryMain,
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
      successBackground: fieldmarkBrand.primaryMain,
    },
    dialogButton: {
      cancel: fieldmarkBrand.secondaryMain,
      confirm: fieldmarkBrand.primaryMain,
      dialogText: '#FFFFFF',
      hoverBackground: '#50790DFF',
    },
    progressBar: {
      background: fieldmarkBrand.appBarBackground,
      complete: fieldmarkBrand.primaryMain,
    },
    icon: {
      main: fieldmarkBrand.secondaryMain,
      light: fieldmarkBrand.appBarBackground,
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
          backgroundColor: fieldmarkBrand.appBarBackground,
          color: fieldmarkBrand.appBarForeground,
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
