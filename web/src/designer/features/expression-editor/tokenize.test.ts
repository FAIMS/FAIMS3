// SPDX-License-Identifier: Apache-2.0
/**
 * @file Unit tests for {@link tokenizeExpression} span splitting.
 */
import {describe, expect, test} from 'vitest';
import {tokenizeExpression} from './tokenize';

describe('tokenizeExpression', () => {
  test('splits text and refs', () => {
    expect(tokenizeExpression('{f_ab} * 2')).toEqual([
      {kind: 'ref', ref: 'f_ab', from: 0, to: 6},
      {kind: 'text', value: ' * 2', from: 6, to: 10},
    ]);
  });

  test('keeps incomplete braces as text', () => {
    expect(tokenizeExpression('{f_ab * 2')).toEqual([
      {kind: 'text', value: '{f_ab * 2', from: 0, to: 9},
    ]);
  });

  test('handles adjacent refs', () => {
    expect(tokenizeExpression('{a}{b}')).toEqual([
      {kind: 'ref', ref: 'a', from: 0, to: 3},
      {kind: 'ref', ref: 'b', from: 3, to: 6},
    ]);
  });
});
