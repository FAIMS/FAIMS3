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
 *   Themes are selected via VITE_THEME (same env var as the main app).
 *   - default   → blue palette matching the default app theme (default-tokens.ts)
 *   - fieldmark → green/orange FAIMS palette (faims-tokens.ts)
 *   - bssTheme  → BSS black/maroon palette (bss-tokens.ts)
 */

// Per origin/main 5dc2d5d42: avoid mixing barrel and deep imports from
// @mui/material — pull createTheme + alpha from the /styles entry point and
// keep `colors` on the barrel import.
import {createTheme, alpha} from '@mui/material/styles';
import {colors} from '@mui/material';
import type {DesignerThemeTokens} from './tokens';
import {faimsTokens} from './faims-tokens';
import {bssTokens} from './bss-tokens';
import {defaultTokens} from './default-tokens';

// ── Re-export token types so consumers don't need a deep import ────────────
export type {DesignerThemeTokens} from './tokens';
export {faimsTokens} from './faims-tokens';
export {bssTokens} from './bss-tokens';
export {defaultTokens} from './default-tokens';

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

// ── Theme name union — matches VITE_THEME values in lib/theme.ts ─────────
export type DesignerThemeName = 'default' | 'bssTheme' | 'fieldmark' | string;

const resolveTokens = (
  themeName: DesignerThemeName
): {tokens: DesignerThemeTokens; isDass: boolean} => {
  if (themeName === 'bssTheme') return {tokens: bssTokens, isDass: true};
  if (themeName === 'fieldmark') return {tokens: faimsTokens, isDass: false};
  return {tokens: defaultTokens, isDass: false};
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
        main: tokens.infoMain,
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
            backgroundColor: '#EAF6FF',
            color: '#17415C',
            fontSize: '0.82rem',
            fontWeight: 600,
            lineHeight: 1.35,
            border: '1px solid #9DD5FF',
            boxShadow: '0 4px 12px rgba(58, 133, 192, 0.18)',
            maxWidth: 340,
            padding: '7px 10px',
            borderRadius: 8,
          },
          arrow: {
            color: '#EAF6FF',
            '&::before': {border: '1px solid #9DD5FF'},
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: colors.grey[500],
            '&.Mui-checked': {
              color: tokens.successMain,
            },
            '&.Mui-disabled': {
              color: colors.grey[400],
            },
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
            marginTop: 16,
            marginBottom: 24,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            border: '1px solid transparent',
            boxShadow: '0 1px 6px rgba(15, 23, 32, 0.06)',
          },
          standardInfo: {
            borderColor: alpha(colors.blueGrey[700], 0.18),
            backgroundColor: alpha(colors.blueGrey[700], 0.06),
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            // Predominantly white surface with a faint blueGrey wash that
            // only surfaces in the bottom-right corner — keeps the input
            // legible and conventional while preserving a subtle accent.
            background: `linear-gradient(135deg, #fff 0%, #fff 85%, ${alpha(
              colors.blueGrey[100],
              0.18
            )} 100%)`,
            transition:
              'box-shadow 160ms ease, background 160ms ease, border-color 160ms ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(colors.blueGrey[800], 0.38),
              borderWidth: 1,
            },
            '&:hover': {
              background: `linear-gradient(135deg, #fff 0%, #fff 80%, ${alpha(
                colors.blueGrey[100],
                0.22
              )} 100%)`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha(colors.blueGrey[900], 0.6),
              },
            },
            '&.Mui-focused': {
              background: `linear-gradient(135deg, #fff 0%, #fff 90%, ${alpha(
                colors.blueGrey[100],
                0.14
              )} 100%)`,
              boxShadow: `0 0 0 3px ${alpha(
                colors.blueGrey[900],
                0.12
              )}, 0 2px 6px ${alpha(colors.common.black, 0.08)}`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.grey[900],
                borderWidth: 2,
              },
            },
            '&.Mui-disabled': {
              background: alpha(colors.blueGrey[50], 0.45),
              boxShadow: 'none',
            },
            '&.Mui-error': {
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(
                  colors.red[700],
                  0.16
                )}, 0 2px 6px ${alpha(colors.common.black, 0.08)}`,
              },
            },
          },
          input: {
            '&::placeholder': {
              color: alpha(colors.blueGrey[700], 0.6),
              opacity: 1,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            letterSpacing: '0.01em',
            '&.Mui-disabled': {
              backgroundColor: alpha(colors.blueGrey[200], 0.42),
              color: colors.blueGrey[600],
              borderColor: alpha(colors.blueGrey[600], 0.2),
            },
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

      
      MuiDialogContent: {
        styleOverrides: {
          root: {
            paddingTop: 24,
            '.MuiDialogTitle-root + &': {
              paddingTop: 24,
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
