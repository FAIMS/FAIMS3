// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {resolveThemeName} from './index';

describe('resolveThemeName', () => {
  it('maps known theme names and falls back to default', () => {
    expect(resolveThemeName('bssTheme')).toBe('bssTheme');
    expect(resolveThemeName('fieldmark')).toBe('fieldmark');
    expect(resolveThemeName('default')).toBe('default');
    expect(resolveThemeName('unknown')).toBe('default');
  });
});
