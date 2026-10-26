// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {opacityFromColor, rgbHexFromColor, withColorOpacity} from './mapColor';

describe('mapColor', () => {
  it('reads RGB from 6- and 8-digit hex', () => {
    expect(rgbHexFromColor('#1565c0')).toBe('#1565c0');
    expect(rgbHexFromColor('#1565C080')).toBe('#1565c0');
    expect(rgbHexFromColor('rgba(21, 101, 192, 0.5)')).toBeUndefined();
  });

  it('treats 6-digit hex as opaque and 8-digit hex as alpha', () => {
    expect(opacityFromColor('#1565c0')).toBe(1);
    expect(opacityFromColor('#1565c080')).toBeCloseTo(128 / 255);
    expect(opacityFromColor('#1565c040')).toBeCloseTo(64 / 255);
    expect(opacityFromColor('#1565c000')).toBe(0);
  });

  it('writes opaque colors as 6-digit hex and fades as 8-digit hex', () => {
    expect(withColorOpacity('#1565c080', 1, '#000000')).toBe('#1565c0');
    expect(withColorOpacity('#1565c0', 0.5, '#000000')).toBe('#1565c080');
    expect(withColorOpacity('#1565c0', 0.25, '#000000')).toBe('#1565c040');
    expect(withColorOpacity('#1565c0', 0, '#000000')).toBe('#1565c000');
  });

  it('keeps the fallback RGB when the stored color is not hex', () => {
    expect(withColorOpacity('blue', 0.5, '#ff0000')).toBe('#ff000080');
  });
});
