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
 *   Component code that needs to branch on theme variant should read
 *   `theme.designerMeta.isDass` or `theme.designerMeta.tokens.*`.
 */

import {createTheme, colors} from '@mui/material';
import {alpha} from '@mui/material/styles';
import type {DesignerThemeTokens} from './tokens';
import {faimsTokens} from './faims-tokens';
import {dassTokens} from './dass-tokens';

// ── Re-export token types so consumers don't need a deep import ────────────
export type {DesignerThemeTokens} from './tokens';
export {faimsTokens} from './faims-tokens';
export {dassTokens} from './dass-tokens';

// ── MUI theme augmentation ────────────────────────────────────────────────
declare module '@mui/material/styles' {
  interface Theme {
    /** Designer-specific metadata injected alongside the MUI palette. */
    designerMeta: {
      /** True when the active theme is DASS / BSS. */
      isDass: boolean;
      /** Full resolved token set for the active theme. */
      tokens: DesignerThemeTokens;
    };
  }
  interface ThemeOptions {
    designerMeta?: {
      isDass?: boolean;
      tokens?: DesignerThemeTokens;
    };
  }
}

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
    // Custom metadata readable via `useTheme().designerMeta`
    designerMeta: {isDass, tokens},

    palette: {
      background: {
        default: tokens.backgroundDefault,
      },
      primary: {
        main: tokens.primaryMain,
        light: tokens.primaryLight,
        dark: tokens.primaryDark,
        contrastText: tokens.primaryContrastText,
      },
      secondary: {
        main: tokens.secondaryMain,
        contrastText: '#fff',
      },
      error: {
        main: tokens.errorMain,
      },
      success: {
        main: tokens.successMain,
      },
      info: {
        main: tokens.tooltipIconColor,
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
          },
        },
      },

      MuiTooltip: {
        defaultProps: {
          arrow: true,
          enterTouchDelay: 80,
          leaveTouchDelay: 2500,
        },
        styleOverrides: {
          tooltip: {
            backgroundColor: '#57A8FF',
            color: '#FFFFFF',
            fontSize: '0.88rem',
            fontWeight: 600,
            lineHeight: 1.4,
            border: '1px solid #8BC4FF',
            boxShadow: '0 4px 12px rgba(22, 86, 153, 0.28)',
            maxWidth: 340,
            padding: '8px 11px',
            borderRadius: 8,
          },
          arrow: {
            color: '#57A8FF',
            '&::before': {border: '1px solid #8BC4FF'},
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: alpha('#0f1720', 0.45),
              backdropFilter: 'blur(1px)',
            },
          },
          paper: {
            borderRadius: 12,
            border: '1px solid rgba(17,24,39,0.12)',
            boxShadow: '0 20px 46px rgba(15, 23, 32, 0.24)',
            overflow: 'hidden',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            letterSpacing: '0.01em',
          },
          contained: {
            boxShadow: '0 2px 8px rgba(15, 23, 32, 0.18)',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(15, 23, 32, 0.24)',
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
              color: tokens.formTabSelectedText,
              backgroundColor: tokens.formTabSelectedBg,
            },
          },
          // Underline indicator — visible for DASS, hidden for FAIMS
          indicator: {
            height: 3,
            backgroundColor: tokens.formTabIndicatorColor,
            display: tokens.formTabIndicatorVisible ? 'block' : 'none',
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
