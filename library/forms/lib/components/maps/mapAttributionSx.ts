// SPDX-License-Identifier: Apache-2.0
/**
 * Attribution chrome under the map canvas. Shared by MapComponent and
 * InteractiveMapLayerPreview so the legal line stays identical.
 */

export const mapAttributionSx = {
  flexShrink: 0,
  typography: 'caption',
  lineHeight: 1.3,
  color: 'text.secondary',
  py: 0.25,
  px: {xs: 0.5, sm: 1},
  wordBreak: 'break-word',
} as const;
