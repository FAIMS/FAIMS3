// SPDX-License-Identifier: Apache-2.0
/**
 * Interactive OpenLayers preview of one map layer.
 *
 * Pan, zoom, and the layers sheet are enabled. Streets, satellite, and the
 * target overlay can be shown, stacked, and painted. Those edits stay in
 * memory for this preview only.
 */

import {Box, Typography} from '@mui/material';
import {Extent} from 'ol/extent';
import TileLayer from 'ol/layer/Tile';
import Map from 'ol/Map';
import 'ol/ol.css';
import {transformExtent} from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import View from 'ol/View';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  applyBaseMapLayerPaint,
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  defaultBaseMapLayersState,
} from './baseMapLayers';
import {
  CompassControl,
  FullscreenControl,
  ZoomControl,
} from './controls/map-controls';
import {MapControlsOverlay, MapControlStack} from './controls/primitives';
import {ContextualLayersControl} from './ContextualLayersControl';
import {
  ContextualMapLayersContext,
  type ContextualMapLayer,
  type ContextualMapLayerPatch,
} from './contextualMapLayers';
import {moveStackedLayer} from './layerOrder';
import {MapControlThemeProvider} from './mapTheme';
import {
  STATIC_MAP_LAYER_PREVIEW_HEIGHT,
  type StaticMapLayerKind,
  type StaticMapLayerStyle,
} from './StaticMapLayerPreview';
import {stopAllTileLoads} from './tileLoadControl';
import {MapConfig} from './types';
import {useBaseMapLayers} from './useBaseMapLayers';
import {useBaseMapTileLoads} from './useBaseMapTileLoads';
import {useContextualMapLayers} from './useContextualMapLayers';
import {useMapFullscreen} from './useMapFullscreen';
import type {TileByteRead} from './pmtilesRange';

const MAP_PROJECTION = 'EPSG:3857';
/** Sit above default streets (0) and satellite (1). */
const PREVIEW_LAYER_Z_INDEX = 2;

export type InteractiveMapLayerPreviewProps = {
  /** Stable id for the overlay row in the layers sheet. */
  id?: string;
  /** Label shown for the target overlay. */
  name: string;
  url: string;
  kind: StaticMapLayerKind;
  extent4326?: [number, number, number, number];
  extent3857?: [number, number, number, number];
  style: StaticMapLayerStyle;
  readTileBytes?: TileByteRead;
  minZoom?: number;
  maxZoom?: number;
  mapConfig: MapConfig;
  className?: string;
};

/** Pad an extent by 15% (or to a minimum span) so the preview is not edge-tight. */
function bufferExtent(extent: Extent): Extent {
  const [minX, minY, maxX, maxY] = extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const minSpan = 800;
  const padX = Math.max(width * 0.15, (minSpan - width) / 2);
  const padY = Math.max(height * 0.15, (minSpan - height) / 2);
  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

/** Web-mercator extent for fitting; prefers a stored 3857 bbox. */
function placementExtent(
  extent4326?: [number, number, number, number],
  extent3857?: [number, number, number, number]
): Extent | undefined {
  if (extent3857) {
    return [...extent3857];
  }
  if (extent4326) {
    return transformExtent(extent4326, 'EPSG:4326', MAP_PROJECTION);
  }
  return undefined;
}

/** MapTiler raster style slug used for the streets preview layer. */
function maptilerRasterStyle(mapStyle: MapConfig['mapStyle']): string {
  if (mapStyle === 'toner') {
    return 'toner-v2';
  }
  if (mapStyle === 'osm-bright') {
    return 'bright-v2';
  }
  if (mapStyle === 'openstreetmap') {
    return 'openstreetmap';
  }
  return 'basic-v2';
}

/** Online streets raster (MapTiler when a key is set, otherwise OSM). */
function createStreetsLayer(mapConfig: MapConfig): TileLayer {
  if (mapConfig.mapSource === 'maptiler' && mapConfig.mapSourceKey) {
    return new TileLayer({
      source: new XYZ({
        url: `https://api.maptiler.com/maps/${maptilerRasterStyle(mapConfig.mapStyle)}/{z}/{x}/{y}.png?key=${mapConfig.mapSourceKey}`,
        attributions: '© MapTiler © OpenStreetMap contributors',
      }),
    });
  }
  return new TileLayer({
    source: new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors',
    }),
  });
}

/**
 * Online satellite raster. Uses the configured provider when possible,
 * otherwise MapTiler (with a key) or Esri so the layers sheet always
 * lists a satellite row in Control Centre.
 */
function createSatelliteLayer(mapConfig: MapConfig): TileLayer {
  const useMaptiler =
    (mapConfig.satelliteSource === 'maptiler' ||
      (!mapConfig.satelliteSource && mapConfig.mapSource === 'maptiler')) &&
    Boolean(mapConfig.mapSourceKey);
  if (useMaptiler) {
    return new TileLayer({
      source: new XYZ({
        url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${mapConfig.mapSourceKey}`,
        attributions: '© MapTiler © OpenStreetMap contributors',
      }),
    });
  }
  return new TileLayer({
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions:
        'Powered by Esri | Esri, USGS, FAO, NOAA, Maxar, Earthstar Geographics, and the GIS User Community',
    }),
  });
}

function sourceAttribution(layer: TileLayer): string {
  const attributions = layer.getSource()?.getAttributions();
  if (typeof attributions === 'string') {
    return attributions;
  }
  if (typeof attributions === 'function') {
    const value = attributions({} as never);
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
  }
  return '';
}

/** One in-memory overlay for the layers sheet. Remount when the asset changes. */
function PreviewLayerProvider({
  layer,
  children,
}: {
  layer: ContextualMapLayer;
  children: ReactNode;
}) {
  const initial = useRef(layer);
  const [layers, setLayers] = useState<ContextualMapLayer[]>([layer]);

  const value = useMemo(
    () => ({
      layers,
      updateLayer: (id: string, patch: ContextualMapLayerPatch) => {
        setLayers(current =>
          current.map(item => (item.id === id ? {...item, ...patch} : item))
        );
      },
      moveLayer: (id: string, direction: 'up' | 'down') => {
        setLayers(current => moveStackedLayer(current, id, direction));
      },
      resetLayers: () => {
        setLayers([initial.current]);
      },
    }),
    [layers]
  );

  return (
    <ContextualMapLayersContext.Provider value={value}>
      {children}
    </ContextualMapLayersContext.Provider>
  );
}

/**
 * Interactive fitted preview with zoom, compass, fullscreen, and a layers
 * sheet for the target overlay plus streets/satellite. Styling is not saved.
 */
export function InteractiveMapLayerPreview({
  id = 'preview',
  name,
  url,
  kind,
  extent4326,
  extent3857,
  style,
  readTileBytes,
  minZoom,
  maxZoom,
  mapConfig,
  className,
}: InteractiveMapLayerPreviewProps) {
  const overlay = useMemo(
    (): ContextualMapLayer => ({
      id,
      name,
      kind,
      url,
      readTileBytes,
      visible: true,
      opacity: style.opacity,
      zIndex: PREVIEW_LAYER_Z_INDEX,
      stroke: style.stroke,
      fill: style.fill,
      lineWidth: style.lineWidth,
      pointSize: style.pointSize,
      extent4326: extent4326 ?? [0, 0, 0, 0],
      extent3857,
      minZoom,
      maxZoom,
    }),
    [
      id,
      name,
      kind,
      url,
      readTileBytes,
      style,
      extent4326,
      extent3857,
      minZoom,
      maxZoom,
    ]
  );

  return (
    <MapControlThemeProvider>
      <PreviewLayerProvider key={`${id}:${url}`} layer={overlay}>
        <InteractiveMapLayerPreviewImpl
          className={className}
          mapConfig={mapConfig}
          extent4326={extent4326}
          extent3857={extent3857}
        />
      </PreviewLayerProvider>
    </MapControlThemeProvider>
  );
}

/** Map canvas, controls, and session-only streets/satellite paint. */
function InteractiveMapLayerPreviewImpl({
  className,
  mapConfig,
  extent4326,
  extent3857,
}: {
  className?: string;
  mapConfig: MapConfig;
  extent4326?: [number, number, number, number];
  extent3857?: [number, number, number, number];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | undefined>();
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );
  const {isFullscreen, toggleFullscreen} = useMapFullscreen(true);

  const streetsLayer = useMemo(() => {
    const layer = createStreetsLayer(mapConfig);
    const prefs = defaultBaseMapLayersState();
    applyBaseMapLayerPaint(layer, prefs.vector, prefs.vector.visible);
    return layer;
  }, [mapConfig]);
  const satelliteLayer = useMemo(() => {
    const layer = createSatelliteLayer(mapConfig);
    const prefs = defaultBaseMapLayersState();
    applyBaseMapLayerPaint(
      layer,
      prefs.satellite,
      prefs.satellite.visible &&
        (typeof navigator === 'undefined' || navigator.onLine)
    );
    return layer;
  }, [mapConfig]);
  const {
    baseLayers,
    updateBaseLayer,
    resetBaseLayers,
    vectorVisible,
    satelliteVisible,
  } = useBaseMapLayers(streetsLayer, satelliteLayer, isOnline, {
    persist: false,
  });

  const {layerErrors} = useContextualMapLayers(map);
  useBaseMapTileLoads(map, streetsLayer, satelliteLayer);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const target = container.current;
    if (!target) {
      return;
    }
    const olMap = new Map({
      target,
      layers: [streetsLayer, satelliteLayer],
      controls: [],
      view: new View({center: [0, 0], zoom: 2}),
    });
    setMap(olMap);
    return () => {
      stopAllTileLoads(olMap);
      olMap.setTarget(undefined);
      setMap(undefined);
    };
  }, [streetsLayer, satelliteLayer]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const extent = placementExtent(extent4326, extent3857);
    if (!extent) {
      setError('This layer has no extent to fit.');
      return;
    }
    setError('');
    map.updateSize();
    map.getView().fit(bufferExtent(extent), {
      padding: [48, 48, 48, 48],
      maxZoom: 18,
    });
  }, [map, extent4326, extent3857]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const target = map.getTargetElement();
    if (!target || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target);
    const frame = requestAnimationFrame(() => map.updateSize());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map, isFullscreen]);

  const attribution = useMemo(() => {
    const visible = [
      {
        visible: satelliteVisible,
        zIndex:
          baseLayers.find(layer => layer.id === BASE_MAP_SATELLITE_ID)
            ?.zIndex ?? 0,
        attribution: sourceAttribution(satelliteLayer),
      },
      {
        visible: vectorVisible,
        zIndex:
          baseLayers.find(layer => layer.id === BASE_MAP_VECTOR_ID)?.zIndex ??
          0,
        attribution: sourceAttribution(streetsLayer),
      },
    ]
      .filter(layer => layer.visible && layer.attribution)
      .sort((a, b) => b.zIndex - a.zIndex);
    return visible[0]?.attribution ?? sourceAttribution(streetsLayer);
  }, [
    baseLayers,
    satelliteLayer,
    streetsLayer,
    satelliteVisible,
    vectorVisible,
  ]);

  return (
    <Box
      data-testid="interactive-map-layer-preview"
      role={isFullscreen ? 'dialog' : undefined}
      aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? 'Full screen map' : undefined}
      className={className}
      sx={theme => ({
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        ...(isFullscreen && {
          position: 'fixed',
          inset: 0,
          zIndex: theme.zIndex.modal,
          backgroundColor: theme.palette.background.paper,
          overflow: 'hidden',
          pb: 'env(safe-area-inset-bottom, 0px)',
        }),
      })}
    >
      {error ? <Typography color="error">{error}</Typography> : null}
      {Object.entries(layerErrors).map(([id, message]) => (
        <Typography key={id} color="error">
          {message}
        </Typography>
      ))}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          width: '100%',
          height: isFullscreen ? '100%' : STATIC_MAP_LAYER_PREVIEW_HEIGHT,
        }}
      >
        <Box ref={container} sx={{height: '100%', width: '100%'}} />
        {map ? (
          <MapControlsOverlay
            insetSafeArea={isFullscreen}
            topContent={
              <ContextualLayersControl
                map={map}
                baseLayers={baseLayers}
                onUpdateBaseLayer={updateBaseLayer}
                onResetBaseLayers={resetBaseLayers}
                layerErrors={layerErrors}
              />
            }
            topRight={
              <FullscreenControl
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
              />
            }
            bottomRight={
              <MapControlStack>
                <CompassControl map={map} />
                <ZoomControl map={map} />
              </MapControlStack>
            }
          />
        ) : null}
      </Box>
      {attribution ? (
        <Box
          component="div"
          sx={{
            flexShrink: 0,
            fontSize: '10px',
            lineHeight: 1.3,
            color: 'text.secondary',
            py: 0.25,
            px: {xs: 0.5, sm: 1},
            wordBreak: 'break-word',
          }}
        >
          {attribution}
        </Box>
      ) : null}
    </Box>
  );
}
