// SPDX-License-Identifier: Apache-2.0
/**
 * OpenLayers tile-load budgets. Native WebViews keep a conservative
 * profile (WebContent crashed with a larger cache plus decoded trail
 * tiles). Desktop / browser builds can decode more tiles at once.
 */

import {Capacitor} from '@capacitor/core';

export type MapPerformanceProfile = {
  /** In-flight tile reads per layer after the view settles. */
  tileConcurrency: number;
  /** Wait after the last moveend before loading holes. */
  settleMs: number;
  /** Decoded tiles kept per contextual layer. */
  tileCacheSize: number;
  /** Extra pixels around the view for vector overlays. */
  renderBuffer: number;
  /**
   * Duration for fly-to / fit camera moves. `0` jumps with no animation
   * so native WebViews skip the compositor trail that overloaded iOS.
   * Zoom +/- buttons keep their own short duration.
   */
  viewAnimationMs: number;
};

/** iOS / Android. Do not raise without re-checking WebContent. */
export const NATIVE_MAP_PERFORMANCE: MapPerformanceProfile = {
  tileConcurrency: 2,
  settleMs: 200,
  tileCacheSize: 16,
  renderBuffer: 0,
  viewAnimationMs: 0,
};

/** Capacitor `web`: desktop app and Control Centre. */
export const DESKTOP_MAP_PERFORMANCE: MapPerformanceProfile = {
  tileConcurrency: 8,
  settleMs: 50,
  tileCacheSize: 128,
  renderBuffer: 128,
  viewAnimationMs: 800,
};

/**
 * Pick the tile-load budget for this runtime.
 * Tests pass `'web'` / `'ios'` / `'android'` to avoid touching Capacitor.
 */
export function resolveMapPerformanceProfile(
  platform?: string
): MapPerformanceProfile {
  const id = platform ?? Capacitor.getPlatform();
  return id === 'web' ? DESKTOP_MAP_PERFORMANCE : NATIVE_MAP_PERFORMANCE;
}

/**
 * OpenLayers duration for fly-to / fit. `undefined` skips animation
 * (native `viewAnimationMs` is 0). Do not pass this to `view.animate`:
 * OpenLayers treats a missing duration as 1000 ms — use `setCenter`.
 */
export function viewAnimationDuration(
  profile = resolveMapPerformanceProfile()
): number | undefined {
  return profile.viewAnimationMs > 0 ? profile.viewAnimationMs : undefined;
}
