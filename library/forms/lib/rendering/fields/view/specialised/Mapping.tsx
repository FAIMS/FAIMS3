import 'ol/ol.css';
import React from 'react';
import {MapPreview} from '../../../../components/maps/mapPreview';
import {DataViewFieldRenderProps} from '../../../types';

/**
 * MapRenderer component that displays GeoJSON data on an OpenLayers map
 */
export const MapRenderer: React.FC<DataViewFieldRenderProps> = props => {
  return <MapPreview value={props.value} />;
};
