// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {getThemeClass} from './theme';

describe('getThemeClass', () => {
  it('maps known theme names to brand classes', () => {
    expect(getThemeClass('bssTheme')).toBe('theme-bss');
    expect(getThemeClass('fieldmark')).toBe('theme-default');
    expect(getThemeClass('default')).toBe('theme-default');
    expect(getThemeClass('unknown')).toBe('theme-default');
  });
});
