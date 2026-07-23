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
 *   Tests for the typed computed-field expression compiler. Field references
 *   use brace syntax ({Field-ID}); typing is strict with no coercion.
 */

import {
  compileComputedExpression,
  ExpressionError,
  ExprType,
  ExprValue,
} from '../src/uiSpecification/expressions';

// Field types available to the expressions under test, as would be derived
// from a uiSpec's type-returned values at notebook load.
const fieldTypes = new Map<string, ExprType>([
  ['width', 'number'],
  ['height', 'number'],
  ['depth', 'number'],
  ['a', 'number'],
  ['b', 'number'],
  ['Wet-Soil-Mass-g', 'number'],
  ['Number-of-Samples', 'number'],
  ['vegType', 'string'],
  ['vegHeight', 'number'],
  ['siteCode', 'string'],
  ['isActive', 'boolean'],
]);

// Builds a Map scope from a plain object, mirroring how computedFields
// supplies resolved field values.
const scope = (m: Record<string, ExprValue>) =>
  new Map<string, ExprValue>(Object.entries(m));

describe('compileComputedExpression', () => {
  describe('numeric expressions', () => {
    it('evaluates arithmetic over field references', () => {
      expect(
        compileComputedExpression(
          '{width} * {height}',
          fieldTypes,
          'number'
        ).evaluate(scope({width: 3, height: 4}))
      ).toBe(12);
      expect(
        compileComputedExpression(
          '({a} + {b}) / 2',
          fieldTypes,
          'number'
        ).evaluate(scope({a: 10, b: 20}))
      ).toBe(15);
      expect(
        compileComputedExpression(
          '-{depth} * 12',
          fieldTypes,
          'number'
        ).evaluate(scope({depth: 5}))
      ).toBe(-60);
    });

    it('collects referenced field names', () => {
      expect(
        compileComputedExpression(
          '{width} * {height}',
          fieldTypes
        ).references.sort()
      ).toEqual(['height', 'width']);
    });

    it('treats hyphenated field ids as a single reference', () => {
      // The hyphens would be read as subtraction without the braces.
      const compiled = compileComputedExpression(
        '{Wet-Soil-Mass-g} * {Number-of-Samples}',
        fieldTypes,
        'number'
      );
      expect(compiled.references.sort()).toEqual([
        'Number-of-Samples',
        'Wet-Soil-Mass-g',
      ]);
      expect(
        compiled.evaluate(scope({'Wet-Soil-Mass-g': 4, 'Number-of-Samples': 2}))
      ).toBe(8);
    });

    it('still treats a hyphen between references as subtraction', () => {
      expect(
        compileComputedExpression('{a} - {b}', fieldTypes, 'number').evaluate(
          scope({a: 10, b: 3})
        )
      ).toBe(7);
    });

    it('honours precedence and parentheses', () => {
      expect(
        compileComputedExpression('2 + 3 * 4', fieldTypes, 'number').evaluate(
          scope({})
        )
      ).toBe(14);
      expect(
        compileComputedExpression('(2 + 3) * 4', fieldTypes, 'number').evaluate(
          scope({})
        )
      ).toBe(20);
    });

    it('returns null for non-finite results', () => {
      expect(
        compileComputedExpression('1 / 0', fieldTypes, 'number').evaluate(
          scope({})
        )
      ).toBeNull();
    });

    it('returns null when a referenced value is missing', () => {
      expect(
        compileComputedExpression('{width} + 1', fieldTypes, 'number').evaluate(
          scope({})
        )
      ).toBeNull();
    });
  });

  describe('string expressions', () => {
    it('concatenates with &', () => {
      expect(
        compileComputedExpression(
          "{siteCode} & '-' & 'A'",
          fieldTypes,
          'string'
        ).evaluate(scope({siteCode: 'PPAP'}))
      ).toBe('PPAP-A');
    });

    it('compares strings with ordering operators', () => {
      expect(
        compileComputedExpression(
          "'apple' < 'banana' ? 1 : 0",
          fieldTypes,
          'number'
        ).evaluate(scope({}))
      ).toBe(1);
    });

    it('evaluates a nested classification expression', () => {
      // Peter's fireRisk example from #2197, in ternary form.
      const fireRisk = compileComputedExpression(
        "{vegType} == 'hedge' ? ({vegHeight} < 3 ? 'Low' : ({vegHeight} < 5 ? 'Medium' : 'High')) : 'Medium'",
        fieldTypes,
        'string'
      );
      expect(fireRisk.returnType).toBe('string');
      expect(fireRisk.evaluate(scope({vegType: 'hedge', vegHeight: 2}))).toBe(
        'Low'
      );
      expect(fireRisk.evaluate(scope({vegType: 'hedge', vegHeight: 4}))).toBe(
        'Medium'
      );
      expect(fireRisk.evaluate(scope({vegType: 'hedge', vegHeight: 6}))).toBe(
        'High'
      );
      expect(fireRisk.evaluate(scope({vegType: 'tree', vegHeight: 9}))).toBe(
        'Medium'
      );
    });
  });

  describe('boolean expressions', () => {
    it('combines comparisons with logical operators', () => {
      expect(
        compileComputedExpression(
          "{isActive} && {width} > 0 ? 'yes' : 'no'",
          fieldTypes,
          'string'
        ).evaluate(scope({isActive: true, width: 3}))
      ).toBe('yes');
    });

    it('can produce a boolean result', () => {
      expect(
        compileComputedExpression(
          '{width} > 2',
          fieldTypes,
          'boolean'
        ).evaluate(scope({width: 5}))
      ).toBe(true);
    });

    it('mixed-type inputs are fine when the result type matches', () => {
      // String and boolean inputs feeding a numeric result (valid
      // ComputedNumber per #2197 discussion).
      expect(
        compileComputedExpression(
          "{vegType} == 'test' || {isActive} ? 3 : 5",
          fieldTypes,
          'number'
        ).evaluate(scope({vegType: 'x', isActive: true}))
      ).toBe(3);
    });
  });

  describe('compile-time type checking', () => {
    it('rejects arithmetic on non-numbers', () => {
      expect(() =>
        compileComputedExpression('{vegType} * 2', fieldTypes)
      ).toThrow(ExpressionError);
      expect(() => compileComputedExpression("'a' + 'b'", fieldTypes)).toThrow(
        ExpressionError
      );
    });

    it('rejects concatenation of non-strings', () => {
      expect(() =>
        compileComputedExpression('{width} & {height}', fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects logical operators on non-booleans', () => {
      expect(() =>
        compileComputedExpression('{width} && {height}', fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects ordering comparisons on booleans', () => {
      expect(() =>
        compileComputedExpression('{isActive} < true', fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects equality across types', () => {
      expect(() =>
        compileComputedExpression("{width} == 'five'", fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects a non-boolean ternary condition', () => {
      expect(() =>
        compileComputedExpression('{width} ? 1 : 2', fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects mismatched ternary branches', () => {
      expect(() =>
        compileComputedExpression("{width} > 0 ? 3 : 'Not valid'", fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects an expression whose type does not match requiredType', () => {
      expect(() =>
        compileComputedExpression('{width} * 2', fieldTypes, 'string')
      ).toThrow(ExpressionError);
      expect(() =>
        compileComputedExpression("'a' & 'b'", fieldTypes, 'number')
      ).toThrow(ExpressionError);
    });

    it('rejects references to unknown fields', () => {
      expect(() =>
        compileComputedExpression('{missing} + 1', fieldTypes)
      ).toThrow(ExpressionError);
    });
  });

  describe('syntax validation', () => {
    it('rejects unbraced field references', () => {
      expect(() =>
        compileComputedExpression('width * height', fieldTypes)
      ).toThrow(ExpressionError);
    });

    it('rejects malformed braces', () => {
      expect(() => compileComputedExpression('{width', fieldTypes)).toThrow(
        ExpressionError
      );
      expect(() => compileComputedExpression('width}', fieldTypes)).toThrow(
        ExpressionError
      );
      expect(() => compileComputedExpression('{}', fieldTypes)).toThrow(
        ExpressionError
      );
      expect(() => compileComputedExpression('{a{b}}', fieldTypes)).toThrow(
        ExpressionError
      );
    });

    it('rejects function calls, member access and indexing', () => {
      expect(() => compileComputedExpression('fn(1)', fieldTypes)).toThrow(
        ExpressionError
      );
      expect(() => compileComputedExpression('foo.bar', fieldTypes)).toThrow(
        ExpressionError
      );
      expect(() => compileComputedExpression('{a}[0]', fieldTypes)).toThrow(
        ExpressionError
      );
    });

    it('rejects malformed input', () => {
      expect(() => compileComputedExpression('1 +', fieldTypes)).toThrow(
        ExpressionError
      );
    });
  });
});
