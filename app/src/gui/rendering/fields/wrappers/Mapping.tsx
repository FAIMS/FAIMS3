/**
 * TODO this should integrate against the existing mapping wrappers which manage
 * offline maps
 */
import Map from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import 'ol/ol.css';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import React, {useEffect, useRef} from 'react';
import {RenderFunctionComponentProps} from '../types';

/**
 * Extracts and validates GeoJSON geometry from the field value
 * @param value - The raw field value that should contain GeoJSON
 * @returns A valid GeoJSON object or null if invalid
 */
const extractGeoJSON = (value: any): object | null => {
  try {
    // If it's already an object, use it directly
    if (typeof value === 'object' && value !== null) {
      return value;
    }

    // If it's a string, try to parse it
    if (typeof value === 'string') {
      return JSON.parse(value);
    }

    return null;
  } catch (e) {
    console.error('Failed to parse GeoJSON:', e);
    return null;
  }
};

/**
 * MapRenderer component that displays GeoJSON data on an OpenLayers map
 */
export const MapRenderer: React.FC<RenderFunctionComponentProps> = props => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  useEffect(() => {
    // Don't initialize if no map container
    if (!mapRef.current) return;

    // Extract GeoJSON from the value
    const geoJSON = extractGeoJSON(props.value);

    if (!geoJSON) {
      console.warn('No valid GeoJSON found in MapFormField value');
      return;
    }

    // Create vector source from GeoJSON
    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geoJSON, {
        // data source
        dataProjection: 'EPSG:4326',
        // map
        featureProjection: 'EPSG:3857',
      }),
    });

    // Create vector layer for the GeoJSON data
    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    // Create base map layer (OpenStreetMap)
    const baseLayer = new TileLayer({
      source: new OSM(),
    });

    // Initialize the map
    const map = new Map({
      target: mapRef.current,
      layers: [baseLayer, vectorLayer],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
      controls: [],
    });

    // Fit the view to the geometry extent if features exist
    const extent = vectorSource.getExtent();
    if (extent && extent.every(coord => isFinite(coord))) {
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 16,
      });
    }

    // Store map instance for cleanup
    mapInstanceRef.current = map;

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, [props.value]);

  // Extract GeoJSON for validation display
  const geoJSON = extractGeoJSON(props.value);

  if (!geoJSON) {
    return (
      <div style={{padding: '10px', color: '#666'}}>
        No valid GeoJSON data to display
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '400px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        position: 'relative',
        flexShrink: 0,
        minHeight: '400px',
      }}
    />
  );
};
