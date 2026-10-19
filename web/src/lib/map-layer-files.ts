// SPDX-License-Identifier: Apache-2.0
import {
  INPUT_LIMITS,
  MAP_ASSET_PRIMARY_FORMATS,
  MAP_ASSET_UPLOAD_ACCEPT,
  isMapAssetAllowedUploadExtension,
  isMapAssetPrimaryExtension,
  mapAssetFileExtension,
  mapAssetGeoreferencedImageCompanionIssue,
  mapAssetUploadTooLargeMessage,
} from '@faims3/data-model';
import {z} from 'zod';

export const MAP_LAYER_FILE_ACCEPT = MAP_ASSET_UPLOAD_ACCEPT;

/**
 * One or more upload files. PNG and JPEG must include a world file and a
 * `.prj`. Other primaries carry their CRS inside the file.
 */
export function mapLayerFilesSchema() {
  return z.array(z.instanceof(File)).superRefine((files, ctx) => {
    if (files.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a map file.',
      });
      return;
    }
    if (files.length > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES) {
      ctx.addIssue({
        code: 'custom',
        message: `Choose at most ${INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES} files.`,
      });
      return;
    }
    const extensions = files.map(file => mapAssetFileExtension(file.name));
    const unsupported = extensions.find(
      ext => !isMapAssetAllowedUploadExtension(ext)
    );
    if (unsupported) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported file type ${unsupported || '(none)'}.`,
      });
      return;
    }
    if (!extensions.some(ext => isMapAssetPrimaryExtension(ext))) {
      ctx.addIssue({
        code: 'custom',
        message: `Include ${MAP_ASSET_PRIMARY_FORMATS}.`,
      });
      return;
    }
    const companionIssue = mapAssetGeoreferencedImageCompanionIssue(extensions);
    if (companionIssue) {
      ctx.addIssue({
        code: 'custom',
        message: companionIssue,
      });
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: mapAssetUploadTooLargeMessage(),
      });
    }
  });
}
