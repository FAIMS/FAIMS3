/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Interactive map for selecting a rectangular offline map download region.
 */

import type {OfflineMapRegion} from '@faims3/data-model';
import {Alert, Box, Button, Stack, Typography} from '@mui/material';
import Feature from 'ol/Feature';
import {Polygon} from 'ol/geom';
import {Draw} from 'ol/interaction';
import {createBox} from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import type Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useRef, useState} from 'react';
import {MapComponent} from './MapComponent';
import {
  extent4326ToOfflineMapRegion,
  offlineMapRegionToExtent4326,
} from './offlineMapRegionUtils';
import type {MapConfig} from './types';

const regionStyle = new Style({
  fill: new Fill({color: 'rgba(33, 150, 243, 0.2)'}),
  stroke: new Stroke({color: '#2196f3', width: 2}),
});

export type OfflineMapPersistenceAction =
  | {type: 'save'; onClick: () => void; pending?: boolean}
  | {type: 'clear-saved'; onClick: () => void; pending?: boolean};

/** Props for {@link OfflineMapRegionEditor}. */
export type OfflineMapRegionEditorProps = {
  config: MapConfig;
  region?: OfflineMapRegion;
  onRegionChange: (region: OfflineMapRegion | null) => void;
  readOnly?: boolean;
  mapHeight?: number | string;
  showRegionStatus?: boolean;
  showMapControls?: boolean;
  /** When false, hides the built-in draw/clear/save controls (e.g. Control Centre supplies its own). */
  showControls?: boolean;
  /** When true, immediately starts map drawing once the map is ready. */
  drawingActive?: boolean;
  onDrawingActiveChange?: (active: boolean) => void;
  /** Overlay text shown while drawing; defaults to a click-drag instruction. */
  drawingInstruction?: string;
  /** Save or clear-saved action shown beside the draw/clear controls. */
  persistenceAction?: OfflineMapPersistenceAction;
};

const DEFAULT_DRAWING_INSTRUCTION =
  'Click on the map to start your selection, then click again to complete it.';

/**
 * Interactive map editor for drawing a rectangular offline map download region.
 *
 * Converts between EPSG:4326 {@link OfflineMapRegion} polygons and the map's
 * Web Mercator view. Supports read-only preview and optional external controls.
 */
export function OfflineMapRegionEditor({
  config,
  region,
  onRegionChange,
  readOnly = false,
  mapHeight = 480,
  showRegionStatus = true,
  showMapControls = true,
  showControls = true,
  drawingActive = false,
  onDrawingActiveChange,
  drawingInstruction = DEFAULT_DRAWING_INSTRUCTION,
  persistenceAction,
}: OfflineMapRegionEditorProps) {
  const [map, setMap] = useState<Map | undefined>();
  const [isDrawing, setIsDrawing] = useState(false);
  const vectorSourceRef = useRef(new VectorSource());
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawRef = useRef<Draw | null>(null);

  const showRegionOnMap = useCallback(
    (theMap: Map, nextRegion?: OfflineMapRegion) => {
      // Render the saved/draft polygon and fit the view to it.
      const source = vectorSourceRef.current;
      source.clear();

      if (!nextRegion) {
        return;
      }

      const extent4326 = offlineMapRegionToExtent4326(nextRegion);
      const extent3857 = transformExtent(
        extent4326,
        'EPSG:4326',
        theMap.getView().getProjection()
      );
      const feature = new Feature(new Polygon([]));
      feature.getGeometry()?.setCoordinates([
        [
          [extent3857[0], extent3857[1]],
          [extent3857[2], extent3857[1]],
          [extent3857[2], extent3857[3]],
          [extent3857[0], extent3857[3]],
          [extent3857[0], extent3857[1]],
        ],
      ]);
      source.addFeature(feature);
      theMap
        .getView()
        .fit(extent3857, {padding: [24, 24, 24, 24], maxZoom: 14});
    },
    []
  );

  useEffect(() => {
    if (!map) {
      return;
    }

    if (!vectorLayerRef.current) {
      const layer = new VectorLayer({
        source: vectorSourceRef.current,
        style: regionStyle,
        zIndex: 997,
      });
      map.addLayer(layer);
      vectorLayerRef.current = layer;
    }

    showRegionOnMap(map, region);
  }, [map, region, showRegionOnMap]);

  useEffect(() => {
    return () => {
      if (map && drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [map]);

  const stopDrawing = useCallback(() => {
    if (map && drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    setIsDrawing(false);
    onDrawingActiveChange?.(false);
  }, [map, onDrawingActiveChange]);

  const startDrawing = useCallback(() => {
    if (!map || readOnly) {
      return;
    }

    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
    }

    vectorSourceRef.current.clear();

    const draw = new Draw({
      source: vectorSourceRef.current,
      type: 'LineString',
      geometryFunction: createBox(),
      maxPoints: 2,
    });

    draw.on('drawstart', () => {
      vectorSourceRef.current.clear();
    });

    draw.on('drawend', event => {
      stopDrawing();

      const geometry = event.feature.getGeometry();
      if (!geometry) {
        return;
      }

      const extent3857 = geometry.getExtent();
      const extent4326 = transformExtent(
        extent3857,
        map.getView().getProjection(),
        'EPSG:4326'
      );
      onRegionChange(extent4326ToOfflineMapRegion(extent4326));
    });

    map.addInteraction(draw);
    drawRef.current = draw;
    setIsDrawing(true);
    onDrawingActiveChange?.(true);
  }, [map, onRegionChange, onDrawingActiveChange, readOnly, stopDrawing]);

  useEffect(() => {
    if (drawingActive && map && !readOnly && !isDrawing) {
      startDrawing();
    }
  }, [drawingActive, isDrawing, map, readOnly, startDrawing]);

  useEffect(() => {
    if (!drawingActive && isDrawing) {
      stopDrawing();
    }
  }, [drawingActive, isDrawing, stopDrawing]);

  const handleClear = () => {
    vectorSourceRef.current.clear();
    onRegionChange(null);
  };

  return (
    <Stack spacing={2}>
      {!readOnly && showControls && (
        <Stack
          direction="row"
          spacing={1}
          sx={{flexWrap: 'wrap', alignItems: 'center'}}
        >
          <Button
            variant="contained"
            onClick={startDrawing}
            disabled={isDrawing}
          >
            {region ? 'Redraw area' : 'Draw area'}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleClear}
            disabled={!region}
            tabIndex={region ? 0 : -1}
            aria-hidden={!region}
            sx={{visibility: region ? 'visible' : 'hidden'}}
          >
            Clear area
          </Button>
          {persistenceAction?.type === 'save' && (
            <Button
              variant="contained"
              color="primary"
              onClick={persistenceAction.onClick}
              disabled={persistenceAction.pending}
            >
              {persistenceAction.pending ? 'Saving…' : 'Save area'}
            </Button>
          )}
          {persistenceAction?.type === 'clear-saved' && (
            <Button
              variant="outlined"
              color="warning"
              onClick={persistenceAction.onClick}
              disabled={persistenceAction.pending}
            >
              {persistenceAction.pending ? 'Clearing…' : 'Clear saved area'}
            </Button>
          )}
        </Stack>
      )}

      {showRegionStatus && (
        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          sx={{minHeight: theme => theme.typography.body2.lineHeight}}
        >
          {region
            ? `Area configured. ${readOnly ? 'Preview shown below.' : 'Save to apply changes.'}`
            : '\u00A0'}
        </Typography>
      )}

      <Box sx={{height: mapHeight, width: '100%', position: 'relative'}}>
        {isDrawing && drawingInstruction && (
          <Alert
            severity="info"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              zIndex: 1000,
            }}
          >
            {drawingInstruction}
          </Alert>
        )}
        <MapComponent
          parentSetMap={setMap}
          config={config}
          showControls={showMapControls}
          extent={region ? offlineMapRegionToExtent4326(region) : undefined}
        />
      </Box>
    </Stack>
  );
}
