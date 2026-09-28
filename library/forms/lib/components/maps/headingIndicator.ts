/** Gap between the GPS dot and the heading triangle, in screen pixels. */
export const HEADING_INDICATOR_PIXEL_OFFSET = 23;

/**
 * Map coordinate of the heading triangle, `pixelOffset` pixels from `origin`
 * along `headingRadians` (0 = north, clockwise).
 *
 * Axes are easting/northing (+x east, +y north), matching EPSG:3857. An
 * offset in map units stays on that bearing when the view is rotated.
 */
export function headingIndicatorCoordinate(
  origin: readonly [number, number],
  headingRadians: number,
  resolution: number,
  pixelOffset = HEADING_INDICATOR_PIXEL_OFFSET
): [number, number] {
  const mapOffset = pixelOffset * resolution;
  return [
    origin[0] + mapOffset * Math.sin(headingRadians),
    origin[1] + mapOffset * Math.cos(headingRadians),
  ];
}
