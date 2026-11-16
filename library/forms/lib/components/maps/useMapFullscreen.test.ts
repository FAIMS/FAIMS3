// SPDX-License-Identifier: Apache-2.0
import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {useMapFullscreen} from './useMapFullscreen';

describe('useMapFullscreen', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('toggles full screen and locks body scroll while open', () => {
    const {result} = renderHook(() => useMapFullscreen(true));

    expect(result.current.isFullscreen).toBe(false);

    act(() => {
      result.current.toggleFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      result.current.toggleFullscreen();
    });

    expect(result.current.isFullscreen).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape', () => {
    const {result} = renderHook(() => useMapFullscreen(true));

    act(() => {
      result.current.toggleFullscreen();
    });
    expect(result.current.isFullscreen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });

    expect(result.current.isFullscreen).toBe(false);
  });

  it('does nothing when disabled and closes if it becomes disabled', () => {
    const {result, rerender} = renderHook(
      ({enabled}: {enabled: boolean}) => useMapFullscreen(enabled),
      {initialProps: {enabled: false}}
    );

    act(() => {
      result.current.toggleFullscreen();
    });
    expect(result.current.isFullscreen).toBe(false);

    rerender({enabled: true});
    act(() => {
      result.current.toggleFullscreen();
    });
    expect(result.current.isFullscreen).toBe(true);

    rerender({enabled: false});
    expect(result.current.isFullscreen).toBe(false);
  });
});
