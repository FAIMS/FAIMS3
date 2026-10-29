// SPDX-License-Identifier: Apache-2.0
import {
  MAP_ASSET_IMAGE_COMPANION_MESSAGE,
  MAP_ASSET_PRIMARY_FORMATS,
  MAP_ASSET_UPLOAD_ACCEPT,
  isMapAssetAllowedUploadExtension,
  isMapAssetGeoreferencedImageExtension,
  isMapAssetPrimaryExtension,
  isMapAssetVectorExtension,
  isMapAssetWorldFileExtension,
  mapAssetFileExtension,
  mapAssetGeoreferencedImageCompanionIssue,
  mapAssetPrimaryExtension,
} from '../src';

describe('map asset upload rules', () => {
  it('lists every accepted extension in the file-input accept string', () => {
    expect(MAP_ASSET_UPLOAD_ACCEPT).toContain('.geojson');
    expect(MAP_ASSET_UPLOAD_ACCEPT).toContain('.png');
    expect(MAP_ASSET_UPLOAD_ACCEPT).toContain('.pgw');
    expect(MAP_ASSET_UPLOAD_ACCEPT).toContain('.prj');
  });

  it('reads the basename extension without depending on Node path', () => {
    expect(mapAssetFileExtension('sites.GEOJSON')).toBe('.geojson');
    expect(mapAssetFileExtension('bores.gdb.zip')).toBe('.zip');
    expect(mapAssetFileExtension('path/to/plan.PNG')).toBe('.png');
    expect(mapAssetFileExtension('C:\\layers\\plan.jGw')).toBe('.jgw');
    expect(mapAssetFileExtension('notes')).toBe('');
    expect(mapAssetFileExtension('.htaccess')).toBe('');
  });

  it('classifies primary, vector, world-file, and image extensions', () => {
    expect(isMapAssetPrimaryExtension('.gpkg')).toBe(true);
    expect(isMapAssetPrimaryExtension('.prj')).toBe(false);
    expect(isMapAssetVectorExtension('.zip')).toBe(true);
    expect(isMapAssetVectorExtension('.tif')).toBe(false);
    expect(isMapAssetWorldFileExtension('.pgw')).toBe(true);
    expect(isMapAssetWorldFileExtension('.prj')).toBe(false);
    expect(isMapAssetAllowedUploadExtension('.prj')).toBe(true);
    expect(isMapAssetAllowedUploadExtension('.txt')).toBe(false);
    expect(isMapAssetGeoreferencedImageExtension('.jpeg')).toBe(true);
    expect(isMapAssetGeoreferencedImageExtension('.tif')).toBe(false);
  });

  it('picks the first primary extension in the upload set', () => {
    expect(mapAssetPrimaryExtension(['.pgw', '.geojson', '.prj'])).toBe(
      '.geojson'
    );
    expect(mapAssetPrimaryExtension(['.prj', '.pgw'])).toBeUndefined();
  });

  it('requires a world file and a .prj beside PNG or JPEG', () => {
    expect(mapAssetGeoreferencedImageCompanionIssue(['.png'])).toBe(
      MAP_ASSET_IMAGE_COMPANION_MESSAGE
    );
    expect(mapAssetGeoreferencedImageCompanionIssue(['.jpg', '.jgw'])).toBe(
      MAP_ASSET_IMAGE_COMPANION_MESSAGE
    );
    expect(mapAssetGeoreferencedImageCompanionIssue(['.jpeg', '.prj'])).toBe(
      MAP_ASSET_IMAGE_COMPANION_MESSAGE
    );
    expect(
      mapAssetGeoreferencedImageCompanionIssue(['.png', '.pgw', '.prj'])
    ).toBeUndefined();
    expect(
      mapAssetGeoreferencedImageCompanionIssue(['.geojson'])
    ).toBeUndefined();
  });

  it('keeps the missing-primary phrase aligned with MAP_ASSET_PRIMARY_FORMATS', () => {
    expect(MAP_ASSET_PRIMARY_FORMATS).toMatch(/GeoJSON/);
  });
});
