// SPDX-License-Identifier: Apache-2.0
/**
 * Attribution chrome under the map canvas. Shared by MapComponent and
 * InteractiveMapLayerPreview so the 10px legal line stays identical.
 */

export const mapAttributionSx = {
  flexShrink: 0,
  fontSize: '10px',
  lineHeight: 1.3,
  color: 'text.secondary',
  py: 0.25,
  px: {xs: 0.5, sm: 1},
  wordBreak: 'break-word',
} as const;
