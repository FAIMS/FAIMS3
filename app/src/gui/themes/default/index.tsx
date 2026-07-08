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
 *   Default FAIMS open-source theme. Primary colour derived from the FAIMS
 *   logo blue (#223883).
 */
import {colors, createTheme} from '@mui/material';
import {defaultBrand, mapControlBrand} from '@faims3/data-model';
import typography from './typography';
import {buildSharedComponentOverrides} from '../sharedComponentOverrides';

const baseTheme = createTheme({
  stepperColors: {
    current: '#000000',
    visited: defaultBrand.primaryMain,
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
    mobileBackground: '#FFFFFF',
  },
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#FFFFFFFF',
      lightBackground: '#E8EAF0',
      tabsBackground: '#E8EAF0',
    },
    primary: {
      main: defaultBrand.primaryMain,
      light: defaultBrand.primaryLight,
      dark: defaultBrand.primaryDark,
    },
    stepper: {
      current: defaultBrand.secondaryMain,
      visited: defaultBrand.primaryMain,
      error: '#D50C0CFF',
      notVisited: '#A8B0C8',
    },
    highlightColor: {
      main: defaultBrand.secondaryMain,
      contrastText: defaultBrand.primaryDark,
    },
    secondary: {
      main: defaultBrand.secondaryMain,
      contrastText: defaultBrand.secondaryMain,
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
      successBackground: defaultBrand.primaryMain,
    },
    dialogButton: {
      cancel: defaultBrand.secondaryMain,
      confirm: defaultBrand.primaryMain,
      dialogText: '#FFFFFF',
      hoverBackground: '#1A2C68',
    },
    progressBar: {
      background: defaultBrand.appBarBackground,
      complete: defaultBrand.primaryMain,
    },
    icon: {
      main: defaultBrand.secondaryMain,
      light: defaultBrand.appBarBackground,
      required: '#890808FF',
      highlight: '#B10000',
    },
    table: {
      divider: '#828789FF',
      rowBorder: '#D3D1D1FF',
      columnSeparator: '#828789FF',
    },
    mapControl: {
      groupBackground: 'rgba(255, 255, 255, 0.95)',
      groupShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
      buttonBackground: '#171717',
      buttonBackgroundHover: '#323232',
      buttonActiveBackground: mapControlBrand.activeMain,
      buttonActiveBackgroundHover: mapControlBrand.activeHover,
      buttonForeground: '#FFFFFF',
    },
  },
  typography,
});

const theme = createTheme(baseTheme, {
  components: {
    ...buildSharedComponentOverrides(baseTheme),
    MuiAppBar: {
      styleOverrides: {
        root: {
          '&.MuiAppBar-root': {
            boxShadow: 'none',
          },
        },
        colorPrimary: {
          backgroundColor: defaultBrand.appBarBackground,
          color: defaultBrand.appBarForeground,
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
            backgroundColor: '#b5d3d5',
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
