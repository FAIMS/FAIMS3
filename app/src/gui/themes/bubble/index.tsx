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

import {createTheme} from '@mui/material';
import typography from './typography';
const primaryMainColor = '#000000';

const theme = createTheme({
  palette: {
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
      draftBackground: '#F4F4F4',
      lightBackground: '#f3f3f3',
      tabsBackground: '#F0F0F0FF',
    },
    primary: {
      main: primaryMainColor,
      light: '#FFFFFF',
    },
    highlightColor: {
      main: '#B10000',
      contrastText: 'F4F4F4',
    },
    secondary: {
      main: '#12B0FB',
      contrastText: '#F4F4F4',
    },
    text: {
      primary: '#000000FF',
      secondary: '#000000',
    },
    alert: {
      warningBackground: '#FFFFFF',
      warningText: '#BC0505',
      infoBackground: '#E5F6FD',
      infoText: '#084C61',
    },
    dialogButton: {
      cancel: '#606060',
      confirm: '#B10000',
      dialogText: '#FFFFFF',
      hoverBackground: '#711111FF',
    },
    progressBar: {
      background: '#edeeeb',
      complete: '#EA6216',
    },
    icon: {
      main: '#197A01',
      light: '#EAEAEA',
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
        colorPrimary: {
          backgroundColor: '#FFFFFF',
          color: '#000000',
        },
      },
    },
  },
});

export default theme;
