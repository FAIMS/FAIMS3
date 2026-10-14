// SPDX-License-Identifier: Apache-2.0
import {FeatureLike} from 'ol/Feature';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import type {ContextualMapLayer} from './contextualMapLayers';

/** Client paint for GeoJSON and vector tiles. Raster tiles ignore this. */
export function contextualVectorStyle(spec: ContextualMapLayer) {
  return (feature: FeatureLike) => {
    const labelValue = spec.labelField
      ? feature.get(spec.labelField)
      : undefined;
    const label =
      labelValue === undefined || labelValue === null ? '' : String(labelValue);
    return new Style({
      stroke: new Stroke({color: spec.stroke, width: spec.lineWidth}),
      fill: new Fill({color: spec.fill}),
      image: new CircleStyle({
        radius: spec.pointSize,
        fill: new Fill({color: spec.stroke}),
        stroke: new Stroke({color: '#ffffff', width: 1}),
      }),
      text: label
        ? new Text({
            text: label,
            font: '12px sans-serif',
            fill: new Fill({color: spec.stroke}),
            stroke: new Stroke({color: '#ffffff', width: 3}),
            offsetY: -14,
          })
        : undefined,
    });
  };
}
