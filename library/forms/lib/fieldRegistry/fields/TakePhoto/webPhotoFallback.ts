// Copyright 2026 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Web-only fallback for Capacitor Camera `quality` / `width`.
 *
 * `@capacitor/camera` on iOS/Android honours `quality: 60` (JPEG compress)
 * and `width: 1920` (downscale). The web plugin does neither:
 * `Camera.pickImages` returns `URL.createObjectURL(file)` for the picked
 * File as-is, and `Camera.getPhoto` returns the raw File as base64 / object
 * URL. A desktop gallery batch of 10 can therefore be tens of MB written
 * straight into PouchDB and synced. `photos.slice(0, 10)` only caps count.
 *
 * Call {@link preparePhotoBlobForStorage} before `storePhoto` on every
 * capture and gallery pick. Native platforms pass through; web re-encodes.
 * Canvas re-encoding strips EXIF — acceptable on web (no geotag path).
 */

import {Capacitor} from '@capacitor/core';
import {logInfo, logWarn} from '../../../logging';

/**
 * JPEG quality on the 0–100 scale Capacitor Camera uses for `quality`.
 * Native iOS/Android honour this; the web plugin ignores it.
 */
export const IMAGE_QUALITY_0_100 = 60;

/**
 * Maximum encoded width in CSS pixels, matching Capacitor Camera `width`.
 * Native iOS/Android honour this; the web plugin ignores it.
 */
export const MAX_IMAGE_WIDTH = 1920;

/**
 * MIME subtype written after a successful web re-encode (`image/jpeg`).
 * Always `jpeg` regardless of the source format (png, heic, gif, …).
 */
export const WEB_RESIZED_FORMAT = 'jpeg';

/** Result of {@link preparePhotoBlobForStorage}. */
export type PreparedPhoto = {
  /** Blob to preview and persist. Original on native / encode failure. */
  photoBlob: Blob;
  /**
   * Capacitor-style format string for `image/${format}`.
   * `jpeg` after a successful web re-encode; otherwise the source format.
   */
  format: string;
  /** True only when `photoBlob` is a new canvas JPEG, not the input. */
  resized: boolean;
};

/**
 * Optional overrides for {@link preparePhotoBlobForStorage}.
 * Production callers omit this object so defaults apply.
 */
export type PreparePhotoOptions = {
  /**
   * Platform id used to decide whether to re-encode.
   * Defaults to `Capacitor.getPlatform()`. Tests pass `'web'` / `'ios'` /
   * `'android'` to avoid touching Capacitor.
   */
  platform?: string;
  /**
   * Encoded width cap in CSS pixels. Defaults to {@link MAX_IMAGE_WIDTH}.
   * Height is derived from aspect ratio; it is not independently capped.
   */
  maxWidth?: number;
  /**
   * JPEG quality on the 0–100 scale. Defaults to {@link IMAGE_QUALITY_0_100}.
   * Converted to 0–1 before `canvas.toBlob`.
   */
  quality0to100?: number;
};

/**
 * Prepare a captured or picked photo for PouchDB storage.
 *
 * Native (`ios` / `android`): returns `blob` unchanged. The plugin already
 * resized and JPEG-compressed; a second canvas pass would strip EXIF that
 * geotagging writes to the file on disk.
 *
 * Web: decode → downscale if width exceeds `maxWidth` (aspect ratio kept) →
 * JPEG-encode at `quality0to100 / 100`. Re-encodes even when already under
 * the width cap so a high-quality phone JPEG is still compressed to the
 * same target the native plugin would have applied.
 *
 * Encode failure (HEIC, missing canvas, undecodable bytes): returns the
 * original `blob` and `format`, logs a warning, and sets `resized: false`.
 * The user's save is never rejected because of this fallback.
 *
 * @param blob - Image bytes from `Camera.getPhoto` / `Camera.pickImages`
 * @param format - Capacitor format for the source (`jpeg`, `png`, `gif`, …)
 * @param options - Platform / size / quality overrides; omit in production
 * @returns The blob and format to pass to `storePhoto`, plus a `resized` flag
 */
export async function preparePhotoBlobForStorage(
  blob: Blob,
  format: string,
  options: PreparePhotoOptions = {}
): Promise<PreparedPhoto> {
  const platform = options.platform ?? Capacitor.getPlatform();
  if (platform !== 'web') {
    return {photoBlob: blob, format, resized: false};
  }

  const maxWidth = options.maxWidth ?? MAX_IMAGE_WIDTH;
  const quality0to100 = options.quality0to100 ?? IMAGE_QUALITY_0_100;

  try {
    const resized = await encodePhotoBlobForWeb(blob, {
      maxWidth,
      quality: quality0to100 / 100,
    });
    logInfo('TakePhoto:web-resize', {
      sourceBytes: blob.size,
      resultBytes: resized.size,
      sourceFormat: format,
    });
    return {
      photoBlob: resized,
      format: WEB_RESIZED_FORMAT,
      resized: true,
    };
  } catch (err) {
    logWarn(
      'TakePhoto: web resize fallback failed; storing the original blob.',
      err
    );
    return {photoBlob: blob, format, resized: false};
  }
}

/**
 * Compute the canvas size that matches native Capacitor Camera `width`.
 *
 * Native `width` constrains the encoded **width** only. A 3024×4032 portrait
 * becomes 1920×2560 — the long side is not independently capped. Images
 * whose width is already ≤ `maxWidth` are left at their source size;
 * {@link encodePhotoBlobForWeb} still JPEG-compresses them.
 *
 * Invalid or non-finite dimensions (zero, negative, NaN) are returned
 * unchanged with `scaled: false` so the caller can reject them.
 *
 * @param sourceWidth - Decoded image width in CSS pixels
 * @param sourceHeight - Decoded image height in CSS pixels
 * @param maxWidth - Width cap; defaults to {@link MAX_IMAGE_WIDTH} (1920)
 * @returns Target `width` / `height` (integers when scaled) and whether
 *   a scale was applied
 */
export function computeWebPhotoTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number = MAX_IMAGE_WIDTH
): {width: number; height: number; scaled: boolean} {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(maxWidth) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    maxWidth <= 0
  ) {
    return {width: sourceWidth, height: sourceHeight, scaled: false};
  }

  if (sourceWidth <= maxWidth) {
    return {width: sourceWidth, height: sourceHeight, scaled: false};
  }

  const scale = maxWidth / sourceWidth;
  return {
    width: maxWidth,
    height: Math.max(1, Math.round(sourceHeight * scale)),
    scaled: true,
  };
}

/** Canvas encode inputs. `quality` is the 0–1 scale `toBlob` expects. */
type EncodeOptions = {
  /** Width cap in CSS pixels; see {@link computeWebPhotoTargetSize}. */
  maxWidth: number;
  /** JPEG quality in the 0–1 range (`IMAGE_QUALITY_0_100 / 100`). */
  quality: number;
};

/**
 * Decode `blob` and re-encode it as a JPEG, downscaling when needed.
 *
 * Draws the decoded bitmap onto an off-DOM canvas at the size returned
 * by {@link computeWebPhotoTargetSize}, then calls `canvas.toBlob` with
 * `image/jpeg` and `quality`. Releases the bitmap / object URL in a
 * `finally` so a failed encode does not leak.
 *
 * This function always throws on failure. {@link preparePhotoBlobForStorage}
 * is the safe wrapper that swallows those errors and keeps the original.
 *
 * @param blob - Source image bytes (any browser-decodable type)
 * @param options - Target width cap and JPEG quality
 * @param options.maxWidth - Encoded width cap in CSS pixels
 * @param options.quality - JPEG quality from 0 (lowest) to 1 (highest)
 * @returns A new `image/jpeg` Blob
 * @throws If the image cannot be decoded, has invalid dimensions, 2D
 *   canvas is unavailable, or `toBlob` returns empty
 */
export async function encodePhotoBlobForWeb(
  blob: Blob,
  options: EncodeOptions
): Promise<Blob> {
  const {maxWidth, quality} = options;
  const decoded = await decodeImageForResize(blob);
  try {
    const {width, height} = computeWebPhotoTargetSize(
      decoded.width,
      decoded.height,
      maxWidth
    );
    if (width <= 0 || height <= 0) {
      throw new Error('Decoded image has invalid dimensions');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context is unavailable');
    }
    ctx.drawImage(decoded.source, 0, 0, width, height);

    if (typeof canvas.toBlob !== 'function') {
      throw new Error('canvas.toBlob is unavailable');
    }

    return await canvasToJpegBlob(canvas, quality);
  } finally {
    decoded.release();
  }
}

/** Decoded raster plus a cleanup hook for the bitmap or object URL. */
type DecodedImage = {
  /** Drawable source for `canvas.drawImage`. */
  source: CanvasImageSource;
  /** Intrinsic width of the decoded raster, after EXIF orientation if applied. */
  width: number;
  /** Intrinsic height of the decoded raster, after EXIF orientation if applied. */
  height: number;
  /** Close the ImageBitmap or revoke the object URL. Always call once. */
  release: () => void;
};

/**
 * Decode `blob` into a canvas-drawable source.
 *
 * Prefers `createImageBitmap` with `imageOrientation: 'from-image'` so
 * EXIF rotation is applied (the web plugin ignores `correctOrientation`).
 * If that option is rejected, retries without it. If `createImageBitmap`
 * is missing or both attempts fail, falls back to {@link loadHtmlImage}.
 *
 * @param blob - Source image bytes
 * @returns Decoded source, pixel size, and a `release` function
 * @throws If every decode path fails (e.g. HEIC in an unsupported browser)
 */
async function decodeImageForResize(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
      });
      return bitmapToDecoded(bitmap);
    } catch {
      // Older browsers reject the orientation option; try without it.
      try {
        const bitmap = await createImageBitmap(blob);
        return bitmapToDecoded(bitmap);
      } catch {
        // Fall through to HTMLImageElement.
      }
    }
  }

  return loadHtmlImage(blob);
}

/**
 * Wrap an `ImageBitmap` as a {@link DecodedImage}.
 *
 * `release` calls `bitmap.close()` so the decoded pixels can be freed
 * immediately after `drawImage`.
 *
 * @param bitmap - Result of `createImageBitmap`
 * @returns Decoded image whose source is the bitmap
 */
function bitmapToDecoded(bitmap: ImageBitmap): DecodedImage {
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

/**
 * Decode `blob` via `HTMLImageElement` when `createImageBitmap` is
 * unavailable or rejected.
 *
 * Creates a temporary object URL, loads it into an `Image`, and returns
 * a {@link DecodedImage} whose `release` revokes that URL. On load
 * error the URL is revoked immediately and the promise rejects.
 *
 * @param blob - Source image bytes
 * @returns Decoded image whose source is the loaded `HTMLImageElement`
 * @throws If the image element fires `error` (undecodable type or corrupt data)
 */
function loadHtmlImage(blob: Blob): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        release: () => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image for web resize'));
    };
    image.src = objectUrl;
  });
}

/**
 * Promisify `canvas.toBlob` as JPEG.
 *
 * @param canvas - Canvas already drawn at the target size
 * @param quality - JPEG quality in the 0–1 range
 * @returns The encoded JPEG blob
 * @throws If `toBlob` invokes the callback with `null` (encode failure or
 *   missing canvas implementation)
 */
function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      result => {
        if (!result) {
          reject(new Error('canvas.toBlob returned empty result'));
          return;
        }
        resolve(result);
      },
      'image/jpeg',
      quality
    );
  });
}
