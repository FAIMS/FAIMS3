// SPDX-License-Identifier: Apache-2.0
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';

/** Stroke, fill, and point paint shared by vector tiles and record GeoJSON. */
export type VectorPaintSpec = {
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
};

/** Client paint for GeoJSON and vector tiles. Raster tiles ignore this. */
export function contextualVectorStyle(spec: VectorPaintSpec) {
  return new Style({
    stroke: new Stroke({color: spec.stroke, width: spec.lineWidth}),
    fill: new Fill({color: spec.fill}),
    image: new CircleStyle({
      radius: spec.pointSize,
      fill: new Fill({color: spec.stroke}),
      stroke: new Stroke({color: '#ffffff', width: 1}),
    }),
  });
}

/** White halo and a larger point so the tapped record reads as selected. */
export function selectedVectorStyle(spec: VectorPaintSpec) {
  return new Style({
    stroke: new Stroke({
      color: '#ffffff',
      width: Math.max(spec.lineWidth + 1, 5),
    }),
    fill: new Fill({color: spec.fill}),
    image: new CircleStyle({
      radius: spec.pointSize + 3,
      fill: new Fill({color: spec.stroke}),
      stroke: new Stroke({color: '#ffffff', width: 4}),
    }),
  });
}
