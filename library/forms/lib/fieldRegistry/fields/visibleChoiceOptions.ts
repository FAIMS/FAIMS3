// SPDX-License-Identifier: Apache-2.0

/**
 * Runtime filtering of choice-field options by their optional visibility
 * `condition`. Prefers the `conditionFn` attached once by
 * `compileUiSpecConditionals`; falls back to compiling the AST for
 * uncompiled options (unit tests, specs that skipped notebook compile).
 */

import {compileExpression, type RecordValues} from '@faims3/data-model';
import type {ChoiceOption} from './choiceFieldParams';

const selectedValueSet = (
  selected: string | string[] | null | undefined
): Set<string> => {
  if (selected == null || selected === '') return new Set();
  return new Set(Array.isArray(selected) ? selected : [selected]);
};

/**
 * Evaluate the option's visibility condition against `values`. Uses the
 * precompiled `conditionFn` when present so notebook compile runs once.
 */
const optionConditionHolds = (
  option: ChoiceOption,
  values: RecordValues
): boolean => {
  if (option.conditionFn) return option.conditionFn(values);
  if (option.condition == null) return true;
  try {
    return compileExpression(option.condition)(values);
  } catch {
    // Unknown operator or a malformed AST on an uncompiled option: hide it.
    return false;
  }
};

/**
 * True when the option has no condition, the condition evaluates true, or the
 * option is currently selected (so a now-failing choice stays visible).
 */
export const isChoiceOptionVisible = (
  option: ChoiceOption,
  values: RecordValues,
  selected: Set<string>
): boolean => {
  if (selected.has(option.value)) return true;
  return optionConditionHolds(option, values);
};

/**
 * Options the collector may interact with: unconditioned, currently true, or
 * already selected even if the condition is now false.
 */
export const visibleChoiceOptions = (
  options: readonly ChoiceOption[],
  values: RecordValues,
  selected?: string | string[] | null
): ChoiceOption[] => {
  const selectedSet = selectedValueSet(selected);
  return options.filter(option =>
    isChoiceOptionVisible(option, values, selectedSet)
  );
};

/**
 * Maps the configured Other index onto the filtered option list so Other stays
 * after the same visible predecessors.
 */
export const otherOptionPositionAmongVisible = (
  options: readonly ChoiceOption[],
  visible: readonly ChoiceOption[],
  otherOptionPosition?: number
): number => {
  const configured = otherOptionPosition ?? options.length;
  const visibleValues = new Set(visible.map(option => option.value));
  return options
    .slice(0, configured)
    .filter(option => visibleValues.has(option.value)).length;
};
