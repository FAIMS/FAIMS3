// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: expressionConstants.ts
 * Description:
 *   Named mathematical constants usable in computed expressions as
 *   {_CONSTANT.<name>}, mirroring JavaScript's Math constants. The compiler
 *   folds them into number literals, so they never reach the runtime scope
 *   and are not reported as references. Shared by the compiler, reference
 *   classification and the designer's picker.
 */

/** Reserved prefix addressing a named constant. */
export const CONSTANT_REFERENCE_PREFIX = '_CONSTANT.';

/** The constants available to expressions, by name. All are numbers. */
export const EXPRESSION_CONSTANTS: ReadonlyMap<string, number> = new Map([
  ['E', Math.E],
  ['LN2', Math.LN2],
  ['LN10', Math.LN10],
  ['LOG2E', Math.LOG2E],
  ['LOG10E', Math.LOG10E],
  ['PI', Math.PI],
  ['SQRT1_2', Math.SQRT1_2],
  ['SQRT2', Math.SQRT2],
]);

/** Constant names in display order, for pickers and error messages. */
export const EXPRESSION_CONSTANT_NAMES = [...EXPRESSION_CONSTANTS.keys()];

/** Encodes a constant name as a reference (_CONSTANT.<name>). */
export function encodeConstantRef(name: string): string {
  return `${CONSTANT_REFERENCE_PREFIX}${name}`;
}

/** Whether a reference addresses a named constant. */
export function isConstantRef(ref: string): boolean {
  return ref.startsWith(CONSTANT_REFERENCE_PREFIX);
}

/**
 * Decodes a constant reference to its name. Returns null when the input is
 * not a constant reference or carries no name (a bare prefix).
 */
export function decodeConstantRef(ref: string): string | null {
  if (!isConstantRef(ref)) {
    return null;
  }
  const name = ref.slice(CONSTANT_REFERENCE_PREFIX.length);
  return name.length > 0 ? name : null;
}
