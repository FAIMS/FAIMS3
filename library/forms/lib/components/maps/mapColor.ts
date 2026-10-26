// SPDX-License-Identifier: Apache-2.0
/**
 * Hex paint helpers for vector stroke and fill.
 * OpenLayers accepts `#rrggbb` or `#rrggbbaa`; the native color input does not.
 */

const RGB_HEX = /^#([0-9a-fA-F]{6})$/;
const RGBA_HEX = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/;

/** `#rrggbb` from a 6- or 8-digit hex color, if the string is one of those. */
export function rgbHexFromColor(color: string): string | undefined {
  if (RGB_HEX.test(color) || RGBA_HEX.test(color)) {
    return color.slice(0, 7).toLowerCase();
  }
  return undefined;
}

/**
 * Alpha from `#rrggbbaa`, otherwise 1.
 * Six-digit hex and unknown strings are treated as opaque.
 */
export function opacityFromColor(color: string): number {
  const match = RGBA_HEX.exec(color);
  if (!match) {
    return 1;
  }
  return parseInt(match[2], 16) / 255;
}

/** Same RGB with a new alpha. Opaque values stay 6-digit hex. */
export function withColorOpacity(
  color: string,
  opacity: number,
  fallback: string
): string {
  const rgb =
    rgbHexFromColor(color) ?? rgbHexFromColor(fallback) ?? fallback.slice(0, 7);
  const clamped = Math.min(1, Math.max(0, opacity));
  if (clamped >= 1) {
    return rgb;
  }
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${rgb}${alpha}`;
}
