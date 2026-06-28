/*
 * Copyright 2024 Macquarie University
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
 * Filename: expressions.test.ts
 * Description:
 *   Tests for the ComputedField expression compiler. Field references use brace
 *   syntax, e.g. {Width} * {Height}.
 */

import {
  compileComputedExpression,
  ExpressionError,
} from '../src/uiSpecification/expressions';

// Builds a Map scope from a plain object, mirroring how computedFields supplies
// resolved field values.
const scope = (m: Record<string, number>) =>
  new Map<string, number>(Object.entries(m));

describe('compileComputedExpression', () => {
  it('evaluates the ticket examples', () => {
    expect(
      compileComputedExpression('{width} * {height}').evaluate(
        scope({width: 3, height: 4})
      )
    ).toBe(12);
    expect(
      compileComputedExpression('({value1} + {value2})/2').evaluate(
        scope({value1: 10, value2: 20})
      )
    ).toBe(15);
    expect(
      compileComputedExpression('-{depth} * 12').evaluate(scope({depth: 5}))
    ).toBe(-60);
  });

  it('collects referenced field names', () => {
    expect(
      compileComputedExpression('{width} * {height}').references.sort()
    ).toEqual(['height', 'width']);
  });

  it('treats hyphenated field ids as a single reference', () => {
    // The hyphens would be read as subtraction without the braces.
    const compiled = compileComputedExpression('{Wet-Soil-Mass-g} * 2');
    expect(compiled.references).toEqual(['Wet-Soil-Mass-g']);
    expect(compiled.evaluate(scope({'Wet-Soil-Mass-g': 4}))).toBe(8);
  });

  it('still treats a hyphen between references as subtraction', () => {
    expect(
      compileComputedExpression('{a} - {b}').evaluate(scope({a: 10, b: 3}))
    ).toBe(7);
  });

  it('honours precedence and parentheses', () => {
    expect(compileComputedExpression('2 + 3 * 4').evaluate(scope({}))).toBe(14);
    expect(compileComputedExpression('(2 + 3) * 4').evaluate(scope({}))).toBe(
      20
    );
  });

  it('supports conditionals', () => {
    expect(
      compileComputedExpression('{a} > 0 ? {a} * {b} : 0').evaluate(
        scope({a: 2, b: 5})
      )
    ).toBe(10);
    expect(
      compileComputedExpression('{a} > 0 ? {a} * {b} : 0').evaluate(
        scope({a: -1, b: 5})
      )
    ).toBe(0);
    expect(
      compileComputedExpression('{a} > 0 && {b} > 0 ? 1 : 0').evaluate(
        scope({a: 1, b: 2})
      )
    ).toBe(1);
  });

  it('returns null for non-finite results', () => {
    expect(compileComputedExpression('1 / 0').evaluate(scope({}))).toBeNull();
  });

  it('returns null when a referenced field is missing', () => {
    expect(
      compileComputedExpression('{missing} + 1').evaluate(scope({}))
    ).toBeNull();
  });

  it('caches by source string', () => {
    expect(compileComputedExpression('{a} + 1')).toBe(
      compileComputedExpression('{a} + 1')
    );
  });

  it('rejects unbraced field references', () => {
    expect(() => compileComputedExpression('width * height')).toThrow(
      ExpressionError
    );
  });

  it('rejects malformed braces', () => {
    expect(() => compileComputedExpression('{width')).toThrow(ExpressionError);
    expect(() => compileComputedExpression('width}')).toThrow(ExpressionError);
    expect(() => compileComputedExpression('{}')).toThrow(ExpressionError);
    expect(() => compileComputedExpression('{a{b}}')).toThrow(ExpressionError);
  });

  it('rejects function calls, member access and indexing at compile time', () => {
    expect(() => compileComputedExpression('fn(x)')).toThrow(ExpressionError);
    expect(() => compileComputedExpression('foo.bar')).toThrow(ExpressionError);
    expect(() => compileComputedExpression('{a}[0]')).toThrow(ExpressionError);
  });

  it('rejects malformed input', () => {
    expect(() => compileComputedExpression('1 +')).toThrow(ExpressionError);
  });
});
