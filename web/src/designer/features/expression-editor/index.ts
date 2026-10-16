// SPDX-License-Identifier: Apache-2.0
/**
 * @file Public surface for the computed-field expression chip editor.
 */

export {ExpressionEditor} from './ExpressionEditor';
export type {
  ExpressionEditorHandle,
  ExpressionEditorProps,
} from './ExpressionEditor';
export {ExprChipTooltip} from './ExprChipTooltip';
export {
  buildChipModel,
  CHIP_KIND_LABELS,
  createChipCatalog,
  exprTypeLabel,
  fallbackChipModel,
} from './chipModel';
export type {ChipCatalog, ChipModel, ChipModelContext} from './chipModel';
export {
  CHIP_LABEL_MAX_LENGTH,
  EXPR_CHIP_CLASS,
  truncateChipLabel,
} from './refChipExtension';
export {tokenizeExpression} from './tokenize';
