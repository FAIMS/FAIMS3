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
import typography from './typography';
const theme = createTheme({
  stepperColors: {
    current: '#000000',
    visited: '#223883',
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
  },
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#FFFFFFFF',
      lightBackground: '#E8EAF0',
      tabsBackground: '#E8EAF0',
    },
    primary: {main: '#223883', light: '#4A6BC5', dark: '#141E4A'},
    stepper: {
      current: '#b5d3d5',
      visited: '#223883',
      error: '#D50C0CFF',
      notVisited: '#A8B0C8',
    },
    highlightColor: {main: '#b5d3d5', contrastText: '#141E4A'},
    secondary: {main: '#b5d3d5', contrastText: '#b5d3d5'},
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
      successBackground: '#223883',
    },
    dialogButton: {
      cancel: '#b5d3d5',
      confirm: '#223883',
      dialogText: '#FFFFFF',
      hoverBackground: '#1A2C68',
    },
    progressBar: {background: '#E8EAF0', complete: '#223883'},
    icon: {
      main: '#b5d3d5',
      light: '#E8EAF0',
      required: '#890808FF',
      highlight: '#B10000',
    },
    table: {
      divider: '#828789FF',
      rowBorder: '#D3D1D1FF',
      columnSeparator: '#828789FF',
    },
  },
  typography,
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {'&.MuiAppBar-root': {boxShadow: 'none'}},
        colorPrimary: {
          backgroundColor: '#E8EAF0',
          color: '#141E4A',
          contrastText: '#fff',
          textColor: '#fff',
          indicatorColor: '#fff',
          text: {primary: '#fff'},
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '&.MuiTabs-root': {boxShadow: 'none', fontWeight: 'bold'},
          '&.MuiTab-root': {fontWeight: '700 !important'},
          '&.Mui-selected': {
            fontWeight: '700 !important',
            color: 'white',
            backgroundColor: '#b5d3d5',
          },
        },
      },
    },
    MuiTab: {styleOverrides: {root: {'&.MuiTab-root': {fontWeight: 'bold'}}}},
  },
});
export default theme;
