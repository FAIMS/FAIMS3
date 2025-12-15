
import Map from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import 'ol/ol.css';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import React, {useEffect, useMemo, useRef} from 'react';
import {VectorTileStore} from './tile-source';
import {MapConfig} from '../../config';

/**
 * Extracts and validates GeoJSON geometry from the field value
 * @param value - The raw field value that should contain GeoJSON
 * @returns A valid GeoJSON object or null if invalid
 */
const extractGeoJSON = (value: any): object | undefined => {
  try {
    // If it's already an object, use it directly
    if (typeof value === 'object' && value !== undefined && value !== null) {
      return value;
    }
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return undefined;
  } catch (e) {
    console.error('Failed to parse GeoJSON:', e);
    return undefined;
  }
};

/**
 * Creates a style for vector features with enhanced visibility
 */
const createFeatureStyle = () => {
  return new Style({
    // Style for point geometries
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({
        color: 'rgba(255, 69, 0, 0.8)', // Bright orange-red with opacity
      }),
      stroke: new Stroke({
        color: '#fff',
        width: 2,
      }),
    }),
    // Style for line geometries
    stroke: new Stroke({
      color: 'rgba(255, 69, 0, 0.9)',
      width: 3,
    }),
    // Style for polygon geometries
    fill: new Fill({
      color: 'rgba(255, 69, 0, 0.2)',
    }),
  });
};

interface MapPreviewProps {
  config: MapConfig;
  value: any;
}

/**
 * MapPreview component that displays GeoJSON data on an OpenLayers map
 */
export const MapPreview: React.FC<MapPreviewProps> = props => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const tileStore = useMemo(() => new VectorTileStore(props.config), []);

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

    // Create vector layer for the GeoJSON data with custom styling
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createFeatureStyle(),
    });

    const tileLayer = tileStore.getTileLayer();

    // Initialize the map
    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer, vectorLayer],
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
        height: '250px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        position: 'relative',
        flexShrink: 0,
        minHeight: '200px',
      }}
    />
  );
};
