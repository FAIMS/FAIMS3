// SPDX-License-Identifier: Apache-2.0
import {Capacitor} from '@capacitor/core';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  DESKTOP_MAP_PERFORMANCE,
  NATIVE_MAP_PERFORMANCE,
  resolveMapPerformanceProfile,
  viewAnimationDuration,
} from './mapPerformance';

describe('map performance profile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the conservative budget on native platforms', () => {
    expect(resolveMapPerformanceProfile('ios')).toEqual(NATIVE_MAP_PERFORMANCE);
    expect(resolveMapPerformanceProfile('android')).toEqual(
      NATIVE_MAP_PERFORMANCE
    );
    expect(NATIVE_MAP_PERFORMANCE).toEqual({
      tileConcurrency: 2,
      settleMs: 200,
      tileCacheSize: 16,
      renderBuffer: 0,
      viewAnimationMs: 0,
    });
    expect(viewAnimationDuration(NATIVE_MAP_PERFORMANCE)).toBeUndefined();
  });

  it('raises throughput on web / desktop', () => {
    expect(resolveMapPerformanceProfile('web')).toEqual(
      DESKTOP_MAP_PERFORMANCE
    );
    expect(DESKTOP_MAP_PERFORMANCE.tileConcurrency).toBeGreaterThan(
      NATIVE_MAP_PERFORMANCE.tileConcurrency
    );
    expect(DESKTOP_MAP_PERFORMANCE.tileCacheSize).toBeGreaterThan(
      NATIVE_MAP_PERFORMANCE.tileCacheSize
    );
    expect(DESKTOP_MAP_PERFORMANCE.settleMs).toBeLessThan(
      NATIVE_MAP_PERFORMANCE.settleMs
    );
    expect(DESKTOP_MAP_PERFORMANCE.viewAnimationMs).toBeGreaterThan(
      NATIVE_MAP_PERFORMANCE.viewAnimationMs
    );
    expect(viewAnimationDuration(DESKTOP_MAP_PERFORMANCE)).toBe(
      DESKTOP_MAP_PERFORMANCE.viewAnimationMs
    );
  });

  it('defaults to Capacitor.getPlatform()', () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    expect(resolveMapPerformanceProfile()).toEqual(NATIVE_MAP_PERFORMANCE);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    expect(resolveMapPerformanceProfile()).toEqual(DESKTOP_MAP_PERFORMANCE);
  });
});
