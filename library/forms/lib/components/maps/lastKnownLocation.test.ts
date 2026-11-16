// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it} from 'vitest';
import {loadLastLocation, saveLastLocation} from './lastKnownLocation';

describe('lastKnownLocation', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a valid longitude/latitude pair', () => {
    saveLastLocation([151.2, -33.87]);
    expect(loadLastLocation()).toEqual([151.2, -33.87]);
  });

  it('returns null when nothing is stored', () => {
    expect(loadLastLocation()).toBeNull();
  });

  it('treats malformed JSON as no cache', () => {
    localStorage.setItem('last_map_center', '{not-json');
    expect(loadLastLocation()).toBeNull();
  });

  it('rejects a value that is not a two-number pair', () => {
    localStorage.setItem('last_map_center', JSON.stringify([151.2]));
    expect(loadLastLocation()).toBeNull();
    localStorage.setItem(
      'last_map_center',
      JSON.stringify(['151.2', '-33.87'])
    );
    expect(loadLastLocation()).toBeNull();
    localStorage.setItem(
      'last_map_center',
      JSON.stringify({lon: 151.2, lat: -33.87})
    );
    expect(loadLastLocation()).toBeNull();
  });
});
