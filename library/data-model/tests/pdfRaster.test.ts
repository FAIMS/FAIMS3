// SPDX-License-Identifier: Apache-2.0
import {existsSync, readFileSync} from 'fs';
import path from 'path';
import {
  mapAssetNormalizeOptionsFromQuality,
  pdfRenderDpi,
  readGeoreferencedPdfRaster,
} from '../src/data_storage/mapAssetsDB';

function pdfBytes(source: string): Uint8Array {
  return new TextEncoder().encode(source);
}

describe('readGeoreferencedPdfRaster', () => {
  it('sizes the page from the MediaBox at 150 DPI', () => {
    const raster = readGeoreferencedPdfRaster(
      pdfBytes('%PDF-1.4\n1 0 obj\n<< /MediaBox [0 0 720 360] >>\nendobj\n')
    );
    expect(raster).toEqual({widthPx: 1500, heightPx: 750, dpi: 150});
  });

  it('swaps the page edges when the page is rotated a quarter turn', () => {
    const raster = readGeoreferencedPdfRaster(
      pdfBytes(
        '%PDF-1.4\n1 0 obj\n<< /MediaBox [0 0 720 360] /Rotate 90 >>\nendobj\n'
      )
    );
    expect(raster).toEqual({widthPx: 750, heightPx: 1500, dpi: 150});
  });

  const sample = path.join(
    __dirname,
    '../../../tmp/0708-Feb-Rain-Event_12Oct2026_1627.pdf'
  );
  const sampleTest = existsSync(sample) ? it : it.skip;
  sampleTest('reads the FireMapper sample at 150 DPI', () => {
    const raster = readGeoreferencedPdfRaster(
      new Uint8Array(readFileSync(sample))
    );
    expect(raster).toEqual({widthPx: 4967, heightPx: 3508, dpi: 150});
  });
});

describe('pdfRenderDpi', () => {
  it('uses the full DPI at quality 100 and scales down with the edge cap', () => {
    const full = {widthPx: 4967, heightPx: 3508, dpi: 150};
    const high = mapAssetNormalizeOptionsFromQuality(100);
    const mid = mapAssetNormalizeOptionsFromQuality(50);
    expect(pdfRenderDpi(full, high.maxRasterEdgePx)).toBeCloseTo(150);
    expect(pdfRenderDpi(full, mid.maxRasterEdgePx)).toBeCloseTo(
      (150 * 4096) / 4967
    );
  });
});
