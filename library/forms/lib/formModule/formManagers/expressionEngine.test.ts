import {describe, expect, it} from 'vitest';
import {compileExpression, ExpressionError} from './expressionEngine';

// Builds a Map scope from a plain object, mirroring how computedFields supplies
// resolved field values.
const scope = (m: Record<string, number>) =>
  new Map<string, number>(Object.entries(m));

describe('compileExpression', () => {
  it('evaluates the ticket examples', () => {
    expect(
      compileExpression('width * height').evaluate(scope({width: 3, height: 4}))
    ).toBe(12);
    expect(
      compileExpression('(value1 + value2)/2').evaluate(
        scope({value1: 10, value2: 20})
      )
    ).toBe(15);
    expect(compileExpression('-depth * 12').evaluate(scope({depth: 5}))).toBe(
      -60
    );
  });

  it('collects referenced field names', () => {
    expect(compileExpression('width * height').references.sort()).toEqual([
      'height',
      'width',
    ]);
  });

  it('honours precedence and parentheses', () => {
    expect(compileExpression('2 + 3 * 4').evaluate(scope({}))).toBe(14);
    expect(compileExpression('(2 + 3) * 4').evaluate(scope({}))).toBe(20);
  });

  it('supports conditionals', () => {
    expect(
      compileExpression('a > 0 ? a * b : 0').evaluate(scope({a: 2, b: 5}))
    ).toBe(10);
    expect(
      compileExpression('a > 0 ? a * b : 0').evaluate(scope({a: -1, b: 5}))
    ).toBe(0);
    expect(
      compileExpression('a > 0 && b > 0 ? 1 : 0').evaluate(scope({a: 1, b: 2}))
    ).toBe(1);
  });

  it('returns null for non-finite results', () => {
    expect(compileExpression('1 / 0').evaluate(scope({}))).toBeNull();
  });

  it('returns null when a referenced field is missing', () => {
    expect(compileExpression('missing + 1').evaluate(scope({}))).toBeNull();
  });

  it('caches by source string', () => {
    expect(compileExpression('a + 1')).toBe(compileExpression('a + 1'));
  });

  it('rejects function calls, member access and indexing at compile time', () => {
    expect(() => compileExpression('fn(x)')).toThrow(ExpressionError);
    expect(() => compileExpression('foo.bar')).toThrow(ExpressionError);
    expect(() => compileExpression('a[0]')).toThrow(ExpressionError);
  });

  it('rejects malformed input', () => {
    expect(() => compileExpression('1 +')).toThrow(ExpressionError);
  });
});
