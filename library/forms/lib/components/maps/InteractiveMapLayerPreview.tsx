// SPDX-License-Identifier: Apache-2.0
/**
 * Interactive OpenLayers preview of one map layer.
 *
 * Pan, zoom, and the layers sheet are enabled. Streets, satellite, and the
 * target overlay can be shown, stacked, and painted. Those edits stay in
 * memory for this preview only.
 */

import {Box, Typography} from '@mui/material';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import Map from 'ol/Map';
import 'ol/ol.css';
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
import {mapAttributionSx} from './mapAttributionSx';
import {MapControlThemeProvider} from './mapTheme';
import {bufferExtent, placementExtent} from './previewExtent';
import {createStreetsLayer, topVisibleAttribution} from './mapHelpers';
import {
  STATIC_MAP_LAYER_PREVIEW_HEIGHT,
  type StaticMapLayerKind,
  type StaticMapLayerStyle,
} from './StaticMapLayerPreview';
import {
  PrioritizedTileMap,
  setSatelliteTileLoadPriority,
  stopAllTileLoads,
} from './tileLoadControl';
import {MapConfig} from './types';
import {useBaseMapLayers} from './useBaseMapLayers';
import {useBaseMapTileLoads} from './useBaseMapTileLoads';
import {useContextualMapLayers} from './useContextualMapLayers';
import {useIsOnline} from './useIsOnline';
import {useMapFullscreen} from './useMapFullscreen';
import type {TileByteRead} from './pmtilesRange';

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
  /**
   * Optional streets base layer, e.g. the cached `VectorTileStore` layer on
   * a field device so the preview works offline. Defaults to the online
   * streets layer built from `mapConfig`.
   */
  baseLayer?: VectorTileLayer | TileLayer;
  /**
   * Optional satellite base layer. Pass `null` when the host has no
   * satellite source so the layers panel does not offer one; when omitted,
   * an online satellite layer is built from `mapConfig`.
   */
  satelliteLayer?: TileLayer | null;
  className?: string;
};

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
  const layer = useMaptiler
    ? new TileLayer({
        source: new XYZ({
          url: `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${mapConfig.mapSourceKey}`,
          attributions: '© MapTiler © OpenStreetMap contributors',
        }),
      })
    : new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attributions:
            'Powered by Esri | Esri, USGS, FAO, NOAA, Maxar, Earthstar Geographics, and the GIS User Community',
        }),
      });
  setSatelliteTileLoadPriority(layer);
  return layer;
}

/** First attribution string from a layer source, or empty. */
function sourceAttribution(
  layer: TileLayer | VectorTileLayer | undefined
): string {
  if (!layer) {
    return '';
  }
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
 * sheet for the target overlay plus streets/satellite. Styling is not saved:
 * every mount starts from the default view — streets on, satellite off, and
 * the overlay visible at the opacity in `style` (its default opacity).
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
  baseLayer,
  satelliteLayer,
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
          baseLayer={baseLayer}
          satelliteLayer={satelliteLayer}
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
  baseLayer: baseLayerProp,
  satelliteLayer: satelliteLayerProp,
  extent4326,
  extent3857,
}: {
  className?: string;
  mapConfig: MapConfig;
  baseLayer?: VectorTileLayer | TileLayer;
  satelliteLayer?: TileLayer | null;
  extent4326?: [number, number, number, number];
  extent3857?: [number, number, number, number];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | undefined>();
  const [error, setError] = useState('');
  const isOnline = useIsOnline();
  const {isFullscreen, toggleFullscreen} = useMapFullscreen(true);

  // Host-supplied layers may be reused, so always repaint them to the
  // defaults (streets on, satellite off) instead of inheriting whatever
  // visibility/opacity a previous preview left on the shared instance.
  const streetsLayer = useMemo(() => {
    const layer = baseLayerProp ?? createStreetsLayer(mapConfig);
    const prefs = defaultBaseMapLayersState();
    applyBaseMapLayerPaint(layer, prefs.vector, prefs.vector.visible);
    return layer;
  }, [baseLayerProp, mapConfig]);
  const satelliteLayer = useMemo(() => {
    if (satelliteLayerProp === null) {
      return undefined;
    }
    const layer = satelliteLayerProp ?? createSatelliteLayer(mapConfig);
    const prefs = defaultBaseMapLayersState();
    applyBaseMapLayerPaint(
      layer,
      prefs.satellite,
      prefs.satellite.visible &&
        (typeof navigator === 'undefined' || navigator.onLine)
    );
    return layer;
  }, [satelliteLayerProp, mapConfig]);
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
    const target = container.current;
    if (!target) {
      return;
    }
    const olMap = new PrioritizedTileMap({
      target,
      layers: satelliteLayer ? [streetsLayer, satelliteLayer] : [streetsLayer],
      // No `interactions: []` here (unlike the static preview): the default
      // OpenLayers interactions give pan, pinch/mouse-wheel zoom, double-click
      // zoom, rotation, and keyboard pan/zoom.
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
    return topVisibleAttribution(
      [
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
      ],
      sourceAttribution(streetsLayer)
    );
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
        minWidth: 0,
        overflow: 'hidden',
        ...(isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: theme.zIndex.modal,
              backgroundColor: theme.palette.background.paper,
              overflow: 'hidden',
              pb: 'env(safe-area-inset-bottom, 0px)',
              minHeight: 0,
            }
          : undefined),
      })}
    >
      {error ? <Typography color="error">{error}</Typography> : null}
      {Object.entries(layerErrors).map(([id, message]) => (
        <Typography key={id} color="error">
          {message}
        </Typography>
      ))}
      <Box
        data-testid="interactive-map-layer-preview-canvas"
        sx={{
          position: 'relative',
          width: '100%',
          // flex:1 + minHeight:0 collapses to 0px when the parent has no
          // explicit height (Control Centre preview tab). Only use that
          // stretch in fullscreen, where the overlay fills the viewport.
          ...(isFullscreen
            ? {flex: 1, minHeight: 0, height: '100%'}
            : {
                height: STATIC_MAP_LAYER_PREVIEW_HEIGHT,
                flexShrink: 0,
              }),
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
        // Attributions are provider-supplied HTML (e.g. the OSM copyright
        // link from the cached tile store), so render them as MapComponent
        // does rather than showing the raw markup as text.
        <Box
          component="div"
          dangerouslySetInnerHTML={{__html: attribution}}
          sx={mapAttributionSx}
        />
      ) : null}
    </Box>
  );
}
