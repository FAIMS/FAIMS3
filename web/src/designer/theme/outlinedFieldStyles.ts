// SPDX-License-Identifier: Apache-2.0
/**
 * Shared outlined-field chrome for MuiOutlinedInput and non-input hosts
 * (CodeMirror expression editor).
 */

import {colors} from '@mui/material';
import {alpha, type SxProps, type Theme} from '@mui/material/styles';
import type {DesignerThemeTokens} from './tokens';

/** Hover / focus transition used by outlined fields and CodeMirror hosts. */
export const OUTLINED_FIELD_TRANSITION =
  'box-shadow 160ms ease, background 160ms ease, border-color 160ms ease';

/**
 * Rest / hover / focused / disabled surfaces from designer outlined-input tokens.
 *
 * @param tokens - Active designer token set.
 */
export function outlinedFieldBackgrounds(tokens: DesignerThemeTokens) {
  return {
    rest: `linear-gradient(135deg, ${tokens.outlinedInputSurface} 0%, ${tokens.outlinedInputSurface} 85%, ${alpha(
      tokens.outlinedInputWash,
      0.18
    )} 100%)`,
    hover: `linear-gradient(135deg, ${tokens.outlinedInputSurface} 0%, ${tokens.outlinedInputSurface} 80%, ${alpha(
      tokens.outlinedInputWash,
      0.22
    )} 100%)`,
    focused: `linear-gradient(135deg, ${tokens.outlinedInputSurface} 0%, ${tokens.outlinedInputSurface} 90%, ${alpha(
      tokens.outlinedInputWash,
      0.14
    )} 100%)`,
    disabled: alpha(colors.blueGrey[50], 0.45),
  };
}

/**
 * Rest / hover / focused outline colours. Pass `errorColor` to pin every
 * state to the error palette.
 *
 * @param tokens - Active designer token set.
 * @param errorColor - When set, replaces rest/hover/focused border colours.
 */
export function outlinedFieldBorderColors(
  tokens: DesignerThemeTokens,
  errorColor?: string
) {
  return {
    rest: errorColor ?? alpha(tokens.outlinedInputBorder, 0.38),
    hover: errorColor ?? alpha(tokens.outlinedInputHoverBorder, 0.6),
    focused: errorColor ?? tokens.outlinedInputFocusBorder,
  };
}

/**
 * Focus ring used by outlined inputs and the expression-editor host.
 *
 * @param tokens - Active designer token set.
 * @param options.error - Use the error ring colour instead of the focus token.
 * @param options.errorRing - Palette colour for the error halo.
 * @param options.black - Shadow colour (usually `palette.common.black`).
 */
export function outlinedFieldFocusShadow(
  tokens: DesignerThemeTokens,
  options: {error?: boolean; errorRing: string; black: string}
) {
  const ring = options.error
    ? alpha(options.errorRing, 0.16)
    : alpha(tokens.outlinedInputFocusRing, 0.12);
  return `0 0 0 3px ${ring}, 0 2px 6px ${alpha(options.black, 0.08)}`;
}

/**
 * Box `sx` that matches designer `MuiOutlinedInput` chrome for a non-input
 * host (CodeMirror).
 *
 * @param theme - Active designer theme (`designerMeta.tokens` required).
 * @param options.error - Outlined error appearance.
 * @param options.disabled - Non-editable host (opacity + default cursor).
 */
export function outlinedFieldHostSx(
  theme: Theme,
  options: {error?: boolean; disabled?: boolean} = {}
): SxProps<Theme> {
  const tokens = theme.designerMeta.tokens;
  const error = options.error ?? false;
  const disabled = options.disabled ?? false;
  const backgrounds = outlinedFieldBackgrounds(tokens);
  const errorColor = error ? theme.palette.error.main : undefined;
  const borders = outlinedFieldBorderColors(tokens, errorColor);
  const black = theme.palette.common.black;

  return {
    border: '1px solid',
    borderColor: borders.rest,
    borderRadius: theme.shape.borderRadius,
    background: backgrounds.rest,
    transition: OUTLINED_FIELD_TRANSITION,
    cursor: disabled ? 'default' : 'text',
    opacity: disabled ? 0.65 : 1,
    '&:hover': {
      borderColor: borders.hover,
      ...(disabled ? {} : {background: backgrounds.hover}),
    },
    '&:focus-within': {
      borderColor: borders.focused,
      borderWidth: 2,
      background: backgrounds.focused,
      boxShadow: outlinedFieldFocusShadow(tokens, {
        error,
        errorRing: theme.palette.error.main,
        black,
      }),
    },
  };
}
