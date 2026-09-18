// SPDX-License-Identifier: Apache-2.0

import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  computeWebPhotoTargetSize,
  encodePhotoBlobForWeb,
  IMAGE_QUALITY_0_100,
  MAX_IMAGE_WIDTH,
  preparePhotoBlobForStorage,
  WEB_RESIZED_FORMAT,
} from './webPhotoFallback';

describe('computeWebPhotoTargetSize', () => {
  it('downscales landscape photos so width is 1920 and aspect ratio is kept', () => {
    expect(computeWebPhotoTargetSize(4000, 2000)).toEqual({
      width: 1920,
      height: 960,
      scaled: true,
    });
  });

  it('downscales portrait photos against width, not the long side', () => {
    // Native Camera `width: 1920` constrains width only (height may stay > 1920).
    expect(computeWebPhotoTargetSize(3024, 4032)).toEqual({
      width: 1920,
      height: 2560,
      scaled: true,
    });
  });

  it('leaves already-narrow images at their source size', () => {
    expect(computeWebPhotoTargetSize(800, 600)).toEqual({
      width: 800,
      height: 600,
      scaled: false,
    });
  });

  it('does not scale an image that is exactly max width', () => {
    expect(computeWebPhotoTargetSize(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      scaled: false,
    });
  });

  it('accepts an explicit maxWidth override', () => {
    expect(computeWebPhotoTargetSize(4000, 2000, 1000)).toEqual({
      width: 1000,
      height: 500,
      scaled: true,
    });
  });

  it('returns the source size unchanged for invalid dimensions', () => {
    expect(computeWebPhotoTargetSize(0, 100)).toEqual({
      width: 0,
      height: 100,
      scaled: false,
    });
    expect(computeWebPhotoTargetSize(100, -1)).toEqual({
      width: 100,
      height: -1,
      scaled: false,
    });
  });
});

describe('preparePhotoBlobForStorage', () => {
  const original = new Blob(['original-bytes'], {type: 'image/jpeg'});

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes the blob through unchanged on native platforms', async () => {
    const result = await preparePhotoBlobForStorage(original, 'jpeg', {
      platform: 'ios',
    });
    expect(result).toEqual({
      photoBlob: original,
      format: 'jpeg',
      resized: false,
    });
  });

  it('passes the blob through unchanged on Android', async () => {
    const result = await preparePhotoBlobForStorage(original, 'png', {
      platform: 'android',
    });
    expect(result.photoBlob).toBe(original);
    expect(result.format).toBe('png');
    expect(result.resized).toBe(false);
  });

  it('re-encodes as JPEG on web and reports resized', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    stubCanvasEncode({
      sourceWidth: 4000,
      sourceHeight: 2000,
      result: encoded,
    });

    const result = await preparePhotoBlobForStorage(original, 'png', {
      platform: 'web',
    });

    expect(result.resized).toBe(true);
    expect(result.format).toBe(WEB_RESIZED_FORMAT);
    expect(result.photoBlob).toBe(encoded);
    expect(result.photoBlob).not.toBe(original);
  });

  it('falls back to the original blob when encode fails on web', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('undecodable'))
    );
    vi.stubGlobal(
      'Image',
      class {
        set src(_url: string) {
          queueMicrotask(() => {
            this.onerror?.(new Event('error'));
          });
        }
        onerror: ((ev: Event) => void) | null = null;
        onload: ((ev: Event) => void) | null = null;
      }
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await preparePhotoBlobForStorage(original, 'heic', {
      platform: 'web',
    });

    expect(result).toEqual({
      photoBlob: original,
      format: 'heic',
      resized: false,
    });
  });
});

describe('encodePhotoBlobForWeb', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws at the downscaled size and JPEG-encodes at quality 0.6', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    const {drawImage, toBlob, close} = stubCanvasEncode({
      sourceWidth: 4000,
      sourceHeight: 2000,
      result: encoded,
    });

    const out = await encodePhotoBlobForWeb(
      new Blob(['src'], {type: 'image/jpeg'}),
      {maxWidth: MAX_IMAGE_WIDTH, quality: IMAGE_QUALITY_0_100 / 100}
    );

    expect(out).toBe(encoded);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 960);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.6
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('still re-encodes when the image is already under the width cap', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    const {drawImage, toBlob} = stubCanvasEncode({
      sourceWidth: 800,
      sourceHeight: 600,
      result: encoded,
    });

    await encodePhotoBlobForWeb(new Blob(['src'], {type: 'image/jpeg'}), {
      maxWidth: MAX_IMAGE_WIDTH,
      quality: 0.6,
    });

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.6
    );
  });

  it('throws when canvas.toBlob returns empty so the caller can fall back', async () => {
    stubCanvasEncode({
      sourceWidth: 100,
      sourceHeight: 100,
      result: null,
    });

    await expect(
      encodePhotoBlobForWeb(new Blob(['src'], {type: 'image/jpeg'}), {
        maxWidth: MAX_IMAGE_WIDTH,
        quality: 0.6,
      })
    ).rejects.toThrow(/empty result/);
  });
});

function stubCanvasEncode({
  sourceWidth,
  sourceHeight,
  result,
}: {
  sourceWidth: number;
  sourceHeight: number;
  result: Blob | null;
}) {
  const close = vi.fn();
  const drawImage = vi.fn();
  const toBlob = vi.fn(
    (cb: (blob: Blob | null) => void, _type?: string, _quality?: number) => {
      cb(result);
    }
  );

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({
      width: sourceWidth,
      height: sourceHeight,
      close,
    })
  );

  const getContext = vi.fn(() => ({drawImage}));
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions
  ) => {
    if (tagName === 'canvas') {
      const canvas = originalCreateElement('canvas');
      Object.defineProperty(canvas, 'getContext', {value: getContext});
      Object.defineProperty(canvas, 'toBlob', {value: toBlob});
      return canvas;
    }
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement);

  return {drawImage, toBlob, close, getContext};
}
