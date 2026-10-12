// SPDX-License-Identifier: Apache-2.0
/**
 * Pixel size of a georeferenced PDF at full device quality.
 *
 * GDAL rasterizes a PDF at 150 DPI from the page size. Quality 100 keeps
 * that raster. Callers still downsample when the chosen quality asks for a
 * shorter edge.
 */

/** GDAL's PDF open default. Full quality uses this DPI against the page size. */
export const PDF_RASTER_BASELINE_DPI = 150;

/** One inch is 72 PDF points, so pixels = points × DPI / 72. */
const PDF_POINTS_PER_INCH = 72;

/** Right angle. Odd multiples (90°, 270°) swap the page edges. */
const QUARTER_TURN_DEGREES = 90;

export type PdfRasterSize = {
  widthPx: number;
  heightPx: number;
  /** DPI passed to GDAL. */
  dpi: number;
};

/**
 * DPI to pass to GDAL so the rendered long edge matches the quality cap.
 *
 * @param full - Page raster at {@link PDF_RASTER_BASELINE_DPI}.
 * @param maxRasterEdgePx - Longest edge the chosen quality allows.
 * @returns A DPI no higher than `full.dpi`. The page is never enlarged.
 */
export function pdfRenderDpi(
  full: PdfRasterSize,
  maxRasterEdgePx: number
): number {
  const longEdge = Math.max(full.widthPx, full.heightPx);
  // Floor at 1 px so a zero cap cannot ask GDAL for 0 DPI.
  const target = Math.min(longEdge, Math.max(1, maxRasterEdgePx));
  return (full.dpi * target) / longEdge;
}

/**
 * Full-resolution raster for a PDF: its page size at
 * {@link PDF_RASTER_BASELINE_DPI}.
 *
 * @param bytes - Raw PDF bytes. The page box is read from the uncompressed
 *   `/MediaBox` entry; image streams are ignored.
 * @returns Width, height, and DPI, or undefined when no usable page box exists.
 */
export function readGeoreferencedPdfRaster(
  bytes: Uint8Array
): PdfRasterSize | undefined {
  const text = new TextDecoder('latin1').decode(bytes);
  const page = pagePoints(text);
  if (!page) {
    return undefined;
  }
  return {
    // At least one pixel, even if the page rounds down to 0.
    widthPx: Math.max(1, pxFromPoints(page.widthPt)),
    heightPx: Math.max(1, pxFromPoints(page.heightPt)),
    dpi: PDF_RASTER_BASELINE_DPI,
  };
}

/**
 * Page width and height in PDF points (1/72 inch).
 *
 * Uses the first `/MediaBox`, scaled by `/UserUnit` when present (default 1).
 * A quarter-turn `/Rotate` (90 or 270 degrees) swaps the two edges.
 *
 * @param text - PDF bytes decoded as Latin-1, so each file byte stays one character.
 * @returns The page size, or undefined when the box is missing or not positive.
 */
/** Convert a length in PDF points to pixels at the baseline DPI. */
function pxFromPoints(points: number): number {
  return Math.round((points * PDF_RASTER_BASELINE_DPI) / PDF_POINTS_PER_INCH);
}

function pagePoints(
  text: string
): {widthPt: number; heightPt: number} | undefined {
  const box =
    /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(
      text
    );
  if (!box) {
    return undefined;
  }
  const userUnit = /\/UserUnit\s+([\d.]+)/.exec(text);
  // PDF default is 1 user unit = 1 point.
  const unit = userUnit ? Number(userUnit[1]) : 1;
  // MediaBox is [llx lly urx ury].
  let widthPt = (Number(box[3]) - Number(box[1])) * unit;
  let heightPt = (Number(box[4]) - Number(box[2])) * unit;
  if (!(widthPt > 0) || !(heightPt > 0)) {
    return undefined;
  }
  const rotation = /\/Rotate\s+(\d+)/.exec(text);
  const quarterTurns = rotation
    ? Math.round(Number(rotation[1]) / QUARTER_TURN_DEGREES)
    : 0;
  // 90° and 270° are odd quarter-turns, so width and height swap.
  if (Math.abs(quarterTurns) % 2 === 1) {
    const swap = widthPt;
    widthPt = heightPt;
    heightPt = swap;
  }
  return {widthPt, heightPt};
}
