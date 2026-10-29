// SPDX-License-Identifier: Apache-2.0
import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useIsOnline} from './useIsOnline';

describe('useIsOnline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tracks window online and offline events', () => {
    vi.stubGlobal('navigator', {onLine: true});
    const {result} = renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    act(() => {
      vi.stubGlobal('navigator', {onLine: false});
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.stubGlobal('navigator', {onLine: true});
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
