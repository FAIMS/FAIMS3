// SPDX-License-Identifier: Apache-2.0
/**
 * @file CodeMirror theme matching designer outlined inputs and chip colours.
 */

import {EditorView} from '@codemirror/view';
import {alpha, type Theme} from '@mui/material/styles';
import {EXPR_CHIP_CLASS} from './refChipExtension';

/**
 * Per-kind chip washes from the MUI / designer palette.
 *
 * @param theme - Active designer theme (`designerMeta.tokens` when present).
 */
const chipKindStyles = (theme: Theme) => {
  /** Soft fill + border from a palette colour. */
  const wash = (color: string) => ({
    backgroundColor: alpha(color, 0.16),
    color: color,
    borderColor: alpha(color, 0.35),
  });

  return {
    [`.${EXPR_CHIP_CLASS}--field`]: wash(theme.palette.primary.dark),
    [`.${EXPR_CHIP_CLASS}--parent`]: wash(
      theme.designerMeta.tokens.chipWashParent
    ),
    [`.${EXPR_CHIP_CLASS}--related`]: wash(theme.palette.conditionOr.main),
    [`.${EXPR_CHIP_CLASS}--metadata`]: wash(theme.palette.success.dark),
    [`.${EXPR_CHIP_CLASS}--constant`]: wash(
      theme.designerMeta.tokens.chipWashNeutral
    ),
    [`.${EXPR_CHIP_CLASS}--system`]: wash(
      theme.designerMeta.tokens.chipWashNeutral
    ),
    [`.${EXPR_CHIP_CLASS}--error`]: {
      backgroundColor: alpha(theme.palette.error.main, 0.14),
      color: theme.palette.error.dark,
      borderColor: alpha(theme.palette.error.main, 0.45),
    },
  };
};

/**
 * Inner CodeMirror styling: designer body font, MUI outlined padding, compact chips.
 * Focus ring lives on the React wrapper, so `.cm-focused` has no outline.
 *
 * @param theme - MUI theme used for font, colour, and chip washes.
 */
export const expressionEditorTheme = (theme: Theme) =>
  EditorView.theme({
    '&': {
      fontFamily: theme.typography.fontFamily ?? 'inherit',
      fontSize: theme.typography.body1.fontSize as string,
      color: theme.palette.text.primary,
      backgroundColor: 'transparent',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      fontFamily: theme.typography.fontFamily ?? 'inherit',
      padding: '16.5px 14px',
      minHeight: `calc(${theme.typography.body1.lineHeight} * 3 * 1em)`,
      caretColor: theme.palette.text.primary,
    },
    '.cm-line': {
      padding: 0,
    },
    '.cm-gutters': {
      display: 'none',
    },
    [`.${EXPR_CHIP_CLASS}`]: {
      display: 'inline-flex',
      alignItems: 'center',
      height: '20px',
      padding: `0 ${theme.spacing(0.75)}`,
      margin: '0 1px',
      borderRadius: '10px',
      border: '1px solid',
      fontSize: '0.8rem',
      fontWeight: 600,
      lineHeight: 1,
      verticalAlign: 'middle',
      userSelect: 'none',
      cursor: 'default',
      whiteSpace: 'nowrap',
    },
    ...chipKindStyles(theme),
  });
