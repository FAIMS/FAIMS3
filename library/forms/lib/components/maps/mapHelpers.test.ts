// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {topVisibleAttribution} from './mapHelpers';

describe('topVisibleAttribution', () => {
  it('picks the visible layer with the highest zIndex', () => {
    expect(
      topVisibleAttribution(
        [
          {visible: true, zIndex: 0, attribution: 'streets'},
          {visible: true, zIndex: 1, attribution: 'satellite'},
        ],
        'fallback'
      )
    ).toBe('satellite');
  });

  it('skips hidden or empty attributions', () => {
    expect(
      topVisibleAttribution(
        [
          {visible: false, zIndex: 2, attribution: 'satellite'},
          {visible: true, zIndex: 0, attribution: ''},
          {visible: true, zIndex: 1, attribution: 'streets'},
        ],
        'fallback'
      )
    ).toBe('streets');
  });

  it('returns the fallback when nothing visible has copy', () => {
    expect(
      topVisibleAttribution(
        [{visible: false, zIndex: 1, attribution: 'satellite'}],
        'streets'
      )
    ).toBe('streets');
  });
});
