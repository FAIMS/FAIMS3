// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {decodeBase64Tile} from './mapFileRange';

describe('decodeBase64Tile', () => {
  it('round-trips a short range', () => {
    const encoded = btoa(String.fromCharCode(1, 2, 3, 255));
    expect(Array.from(decodeBase64Tile(encoded))).toEqual([1, 2, 3, 255]);
  });
});
