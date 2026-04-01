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
 * See, the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: index.tsx
 * Description:
 *   Taken from the main FAIMS3 proj source code: /src/gui/theme/index.tsx
 *   Amended to fit this project.
 */

import {createTheme, colors} from '@mui/material';

export type DesignerThemeName = 'default' | 'bssTheme' | 'dassTheme' | string;

type ThemeTokens = {
  backgroundDefault: string;
  primaryMain: string;
  primaryLight: string;
  primaryDark: string;
  secondaryMain: string;
  helperTextColor: string;
  appBarBackground: string;
  appBarColor: string;
  tabSelectedBackground: string;
  tabSelectedText: string;
};

const faimsTokens: ThemeTokens = {
  backgroundDefault: '#FAFAFB',
  primaryMain: '#669911',
  primaryLight: '#a7e938',
  primaryDark: '#141E03',
  secondaryMain: '#E18200',
  helperTextColor: colors.blueGrey[500],
  appBarBackground: '#edeeeb',
  appBarColor: '#324C08',
  tabSelectedBackground: '#DA9449',
  tabSelectedText: '#FFFFFF',
};

// DASS is intentionally aligned with the BSS app palette so it is easy to tune later.
const dassTokens: ThemeTokens = {
  backgroundDefault: '#FAFAFB',
  primaryMain: '#000000',
  primaryLight: '#FFFFFF',
  primaryDark: '#000000',
  secondaryMain: '#12B0FB',
  helperTextColor: colors.blueGrey[500],
  appBarBackground: '#FFFFFF',
  appBarColor: '#000000',
  tabSelectedBackground: '#000000',
  tabSelectedText: '#FFFFFF',
};

const resolveTokens = (themeName: DesignerThemeName): ThemeTokens => {
  switch (themeName) {
    case 'bssTheme':
    case 'dassTheme':
    case 'dass':
      return dassTokens;
    case 'default':
    default:
      return faimsTokens;
  }
};

export const createDesignerTheme = (themeName: DesignerThemeName = 'default') => {
  const tokens = resolveTokens(themeName);

  return createTheme({
    palette: {
      background: {
        default: tokens.backgroundDefault,
      },
      primary: {
        main: tokens.primaryMain,
        light: tokens.primaryLight,
        dark: tokens.primaryDark,
      },
      secondary: {
        main: tokens.secondaryMain,
        contrastText: '#fff',
      },
      text: {
        primary: colors.blueGrey[900],
        secondary: colors.blueGrey[600],
        disabled: tokens.helperTextColor,
      },
      divider: '#D3D1D1FF',
    },
    typography: {
      fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
      h1: {
        fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
        fontWeight: 800,
        fontSize: 35,
        letterSpacing: '0',
      },
      h2: {
        fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
        fontWeight: 800,
        fontSize: 29,
        letterSpacing: '0',
      },
      h3: {
        fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
        fontWeight: 800,
        fontSize: 24,
        letterSpacing: '0',
      },
      h4: {
        fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '0',
      },
      h5: {
        fontFamily: "'Noto Sans', 'Open Sans', sans-serif",
        fontWeight: 800,
        fontSize: 16,
        letterSpacing: '0',
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            '&.MuiAppBar-root': {
              boxShadow: 'none',
            },
          },
          colorPrimary: {
            backgroundColor: tokens.appBarBackground,
            color: tokens.appBarColor,
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
              color: tokens.tabSelectedText,
              backgroundColor: tokens.tabSelectedBackground,
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
};

/** MUI theme for the embedded designer (palette aligned with main FAIMS chrome). */
const defaultTheme = createDesignerTheme('default');
export default defaultTheme;
