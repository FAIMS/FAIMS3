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
 *   Designer MUI theme factory.
 *   Token values live in faims-tokens.ts / dass-tokens.ts.
 */

import {createTheme, colors} from '@mui/material';
import type {DesignerThemeTokens} from './tokens';
import {faimsTokens} from './faims-tokens';
import {dassTokens} from './dass-tokens';

// ── Re-export token types so consumers don't need a deep import ────────────
export type {DesignerThemeTokens} from './tokens';
export {faimsTokens} from './faims-tokens';
export {dassTokens} from './dass-tokens';

// ── Theme name union ──────────────────────────────────────────────────────
export type DesignerThemeName = 'default' | 'bssTheme' | 'dassTheme' | 'dass' | string;

const resolveTokens = (
  themeName: DesignerThemeName
): {tokens: DesignerThemeTokens; isDass: boolean} => {
  const isDass =
    themeName === 'bssTheme' || themeName === 'dassTheme' || themeName === 'dass';
  return {tokens: isDass ? dassTokens : faimsTokens, isDass};
};

export const createDesignerTheme = (themeName: DesignerThemeName = 'default') => {
  const {tokens, isDass} = resolveTokens(themeName);

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
          indicator: isDass
            ? {
                height: 3,
                backgroundColor: tokens.secondaryMain,
              }
            : {},
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
