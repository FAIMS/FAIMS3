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

import {createTheme, colors} from '@mui/material';
import typography from './typography';

const theme = createTheme({
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#FFFFFFFF',
      lightBackground: '#edeeeb',
      tabsBackground: '#edeeeb',
    },
    primary: {
      main: '#669911',
      light: '#a7e938',
      dark: '#141E03',
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
    },
    alert: {
      warningBackground: '#FFF4E5',
      warningText: '#5F370E',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
    },
    dialogButton: {
      cancel: '#669907',
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
