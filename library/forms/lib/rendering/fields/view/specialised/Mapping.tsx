import 'ol/ol.css';
import React from 'react';
import {MapPreview} from '../../../../components/maps/MapPreview';
import {DataViewFieldRenderProps} from '../../../types';

/**
 * MapRenderer component that displays GeoJSON data on an OpenLayers map
 */
export const MapRenderer: React.FC<DataViewFieldRenderProps> = props => {
  const config = props.renderContext.tools.getMapConfig();
  return <MapPreview value={props.value} config={config} />;
};
