import type {OfflineMapRegion} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {offlineMapRegionsEqual} from '@faims3/forms';
import {resolveOfflineMapRegionPlanChange} from './projectOfflineMap';

const regionA: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [150.0, -34.0],
      [151.0, -34.0],
      [151.0, -33.0],
      [150.0, -33.0],
      [150.0, -34.0],
    ],
  ],
};

const regionB: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [152.0, -34.0],
      [153.0, -34.0],
      [153.0, -33.0],
      [152.0, -33.0],
      [152.0, -34.0],
    ],
  ],
};

describe('offlineMapRegionsEqual', () => {
  it('treats identical regions as equal', () => {
    expect(offlineMapRegionsEqual(regionA, regionA)).toBe(true);
  });

  it('treats different regions as not equal', () => {
    expect(offlineMapRegionsEqual(regionA, regionB)).toBe(false);
  });
});

describe('resolveOfflineMapRegionPlanChange', () => {
  it('does nothing when the plan region is unchanged', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: regionA,
        nextRegion: regionA,
        hadDownload: true,
        downloadedRegion: regionA,
      })
    ).toEqual({action: 'none'});
  });

  it('prompts to re-download when an activated project download is stale', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: regionA,
        nextRegion: regionB,
        hadDownload: true,
        downloadedRegion: regionA,
      })
    ).toEqual({action: 'prompt', isRegionUpdate: true});
  });

  it('prompts when a legacy download has no stored region metadata', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: regionA,
        nextRegion: regionB,
        hadDownload: true,
        downloadedRegion: undefined,
      })
    ).toEqual({action: 'prompt', isRegionUpdate: true});
  });

  it('does not prompt when the plan region changes but nothing was downloaded', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: regionA,
        nextRegion: regionB,
        hadDownload: false,
        downloadedRegion: undefined,
      })
    ).toEqual({action: 'none'});
  });

  it('prompts when a region is newly configured on an activated notebook', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: undefined,
        nextRegion: regionA,
        hadDownload: false,
        downloadedRegion: undefined,
      })
    ).toEqual({action: 'prompt', isRegionUpdate: false});
  });

  it('removes stale downloads when the plan region is cleared', () => {
    expect(
      resolveOfflineMapRegionPlanChange({
        previousRegion: regionA,
        nextRegion: undefined,
        hadDownload: true,
        downloadedRegion: regionA,
      })
    ).toEqual({action: 'removed_stale_download'});
  });
});
