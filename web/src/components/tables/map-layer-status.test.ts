// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {mapLayerStatusLabel} from './map-layer-status';

describe('mapLayerStatusLabel', () => {
  it('keeps in-progress and failed wording', () => {
    expect(mapLayerStatusLabel({status: 'pending', linkCount: 0})).toBe(
      'Pending'
    );
    expect(mapLayerStatusLabel({status: 'processing', linkCount: 0})).toBe(
      'Processing'
    );
    expect(mapLayerStatusLabel({status: 'failed', linkCount: 0})).toBe(
      'Failed'
    );
  });

  it('uses Ready to link until a survey is attached', () => {
    expect(mapLayerStatusLabel({status: 'ready', linkCount: 0})).toBe(
      'Ready to link'
    );
    expect(mapLayerStatusLabel({status: 'ready', linkCount: 1})).toBe('Ready');
  });
});
