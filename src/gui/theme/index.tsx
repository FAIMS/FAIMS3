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

import { createTheme, colors, adaptV4Theme } from '@mui/material';
// import { Shadows } from '@mui/material/styles';
import typography from './typography';
import shadows from './shadows';
import { Theme } from '@mui/material/styles';

declare module '@mui/styles/defaultTheme' {
  interface DefaultTheme extends Theme {}
}
const theme = createTheme({
  spacing:2,
  palette: {
    primary: {
      main: '#1B3E93',
      contrastText: colors.blueGrey[900]
    },
    secondary: {
      // main: '#F68E1E',
      main: "#1B3E93",
      contrastText: "#fff"
    },
    text: {
      primary: colors.blueGrey[900],
      secondary: colors.blueGrey[600],
    },
    error: {
      main: colors.red[500],
    },
  },
  
  // shadows: shadows as Shadows,
  typography,
  // shadows: Array(25).fill('none') as Shadows,
  components: {
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: "#1B3E93",
          color:'#fff',
          contrastText: "#fff",
          textColor:'#fff',
          indicatorColor:'#fff',
        },
      }
    }
  },
});

export default theme;
