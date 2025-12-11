/**
 * MapWrapper.tsx
 *
 * Provides the interactive map UI for the MapFormField:
 * - Button to open map (when no location selected)
 * - Edit button (when location already selected)
 * - Full-screen dialog with OpenLayers map
 * - Draw/modify interactions for capturing geometry
 *
 * This component handles all the map interaction logic, delegating
 * tile rendering to the injected TileSourceProvider via MapComponent.
 */

import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/LocationOn';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import GeoJSON from 'ol/format/GeoJSON';
import {Draw, Modify} from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Icon, Stroke, Style} from 'ol/style';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Coordinates,
  MapComponent,
  TileSourceProvider,
  WGS84Extent,
} from '../../../maps';

// ============================================================================
// Constants
// ============================================================================

const WGS84_PROJECTION = 'EPSG:4326';

/** Z-index for the drawing layer (below GPS cursor at 999) */
const DRAWING_LAYER_ZINDEX = 998;

// ============================================================================
// Types
// ============================================================================

/** Supported geometry types */
export type MapFeatureType = 'Point' | 'Polygon' | 'LineString';

/** Actions that can be taken from the map dialog */
export type MapAction = 'save' | 'close';

export interface MapWrapperProps {
  /** Button/field label */
  label: string;
  /** Current GeoJSON features (if any) */
  features?: GeoJSONFeatureCollection;
  /** Geometry type to draw */
  featureType: MapFeatureType;
  /** Initial map zoom level */
  zoom: number;
  /** Initial map center [longitude, latitude] */
  center?: Coordinates;
  /** Callback when features are saved or dialog closed */
  onFeaturesChange: (
    features: GeoJSONFeatureCollection,
    action: MapAction
  ) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether a location is currently selected */
  isLocationSelected: boolean;
  /** Tile source provider for map rendering */
  tileSourceProvider: TileSourceProvider;
  /** Whether the app is currently online */
  isOnline: boolean;
}

// ============================================================================
// Styles
// ============================================================================

/**
 * Creates the style for drawn features.
 * Uses a pin icon for points, stroke/fill for polygons and lines.
 */
const createFeatureStyle = (): Style => {
  const pinIcon = new Icon({
    src: '/static/map-pin.png',
    anchor: [0.5, 1],
    scale: 0.25,
  });

  return new Style({
    image: pinIcon,
    fill: new Fill({color: 'rgba(255, 255, 255, 0.4)'}),
    stroke: new Stroke({color: '#3399CC', width: 2}),
  });
};

// ============================================================================
// Map Dialog Component
// ============================================================================

interface MapDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (features: GeoJSONFeatureCollection) => void;
  featureType: MapFeatureType;
  initialFeatures?: GeoJSONFeatureCollection;
  center?: Coordinates;
  zoom: number;
  tileSourceProvider: TileSourceProvider;
  isOnline: boolean;
}

/**
 * Full-screen dialog containing the interactive map with drawing tools.
 */
const MapDialog = ({
  open,
  onClose,
  onSave,
  featureType,
  initialFeatures,
  center,
  zoom,
  tileSourceProvider,
  isOnline,
}: MapDialogProps) => {
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] =
    useState<VectorLayer<VectorSource>>();
  const [featuresExtent, setFeaturesExtent] = useState<WGS84Extent>();
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const geoJson = useMemo(() => new GeoJSON(), []);

  /**
   * Sets up the drawing and modification interactions on the map.
   */
  const setupDrawInteraction = useCallback(
    (theMap: Map) => {
      // Clean up existing drawing layers (preserve base tiles and GPS cursor)
      theMap.getLayers().forEach(layer => {
        const zIndex = layer.getZIndex?.() ?? -1;
        if (zIndex === DRAWING_LAYER_ZINDEX) {
          theMap.removeLayer(layer);
        }
      });

      const vectorSource = new VectorSource();
      const style = createFeatureStyle();

      const layer = new VectorLayer({
        source: vectorSource,
        style,
        zIndex: DRAWING_LAYER_ZINDEX,
      });

      // Drawing interaction
      const draw = new Draw({
        source: vectorSource,
        type: featureType,
      });

      // Modification interaction
      const modify = new Modify({source: vectorSource});

      // Only allow one feature at a time - clear on new draw
      draw.on('drawstart', () => {
        vectorSource.clear();
      });

      // Load existing features if provided
      if (
        initialFeatures?.type === 'FeatureCollection' &&
        initialFeatures.features?.length
      ) {
        const parsedFeatures = geoJson.readFeatures(initialFeatures, {
          dataProjection: WGS84_PROJECTION,
          featureProjection: theMap.getView().getProjection(),
        });
        vectorSource.addFeatures(parsedFeatures);

        // Calculate extent for map centering
        const rawExtent = vectorSource.getExtent();
        if (!rawExtent.includes(Infinity)) {
          const extent = transformExtent(
            rawExtent,
            theMap.getView().getProjection(),
            WGS84_PROJECTION
          ) as WGS84Extent;
          setFeaturesExtent(extent);
        }
      }

      theMap.addLayer(layer);
      theMap.addInteraction(draw);
      theMap.addInteraction(modify);
      setFeaturesLayer(layer);
    },
    [featureType, initialFeatures, geoJson]
  );

  // Set up interactions when dialog opens and map is ready
  useEffect(() => {
    if (open && map) {
      setupDrawInteraction(map);
      // Allow time for dialog animation before updating map size
      setTimeout(() => {
        map.updateSize();
      }, 100);
    }
  }, [open, map, setupDrawInteraction]);

  /**
   * Clears all drawn features from the map.
   */
  const handleClear = () => {
    featuresLayer?.getSource()?.clear();
  };

  /**
   * Saves the current features and closes the dialog.
   */
  const handleSave = () => {
    if (!map) return;

    const source = featuresLayer?.getSource();
    const features = source?.getFeatures() ?? [];

    // Prompt for confirmation if saving empty
    if (features.length === 0) {
      setShowEmptyConfirm(true);
      return;
    }

    const featureCollection = geoJson.writeFeaturesObject(features, {
      featureProjection: map.getView().getProjection(),
      dataProjection: WGS84_PROJECTION,
    }) as GeoJSONFeatureCollection;

    onSave(featureCollection);
    onClose();
  };

  /**
   * Confirms saving an empty feature collection.
   */
  const handleConfirmEmpty = () => {
    setShowEmptyConfirm(false);
    onSave({type: 'FeatureCollection', features: []});
    onClose();
  };

  return (
    <>
      <Dialog
        fullScreen
        open={open}
        onClose={onClose}
        sx={{
          // Respect safe areas on mobile devices
          top: 'var(--safe-area-inset-top)',
          left: 'var(--safe-area-inset-left)',
        }}
      >
        <AppBar position="relative" color="default" elevation={1}>
          <Toolbar sx={{justifyContent: 'space-between'}}>
            {/* Close button */}
            <IconButton
              edge="start"
              onClick={onClose}
              aria-label="close"
              sx={{
                gap: 0.5,
                borderRadius: 1,
                px: 1.5,
              }}
            >
              <CloseIcon />
              <Typography variant="button">Close</Typography>
            </IconButton>

            {/* Action buttons */}
            <Box sx={{display: 'flex', gap: 1}}>
              <Button variant="outlined" color="warning" onClick={handleClear}>
                Clear
              </Button>
              <Button variant="contained" color="success" onClick={handleSave}>
                Save
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Map container */}
        <Box sx={{flexGrow: 1, height: '100%'}}>
          <MapComponent
            key={open ? 'map-open' : 'map-closed'}
            parentSetMap={setMap}
            tileSourceProvider={tileSourceProvider}
            center={center}
            extent={featuresExtent}
            zoom={zoom}
            isOnline={isOnline}
          />
        </Box>
      </Dialog>

      {/* Empty selection confirmation dialog */}
      <Dialog
        open={showEmptyConfirm}
        onClose={() => setShowEmptyConfirm(false)}
      >
        <Alert severity="warning" sx={{m: 0, borderRadius: 0}}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            No location selected
          </Typography>
          <Typography variant="body2">
            Are you sure you want to save an empty location selection?
          </Typography>
        </Alert>
        <DialogActions>
          <Button onClick={() => setShowEmptyConfirm(false)}>Cancel</Button>
          <Button onClick={handleConfirmEmpty} color="warning">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * MapWrapper
 *
 * Renders either:
 * - A button to open the map (when no location selected)
 * - An edit button (when location already selected)
 *
 * Manages the full-screen map dialog for drawing/editing features.
 */
export const MapWrapper = ({
  label,
  features,
  featureType,
  zoom,
  center,
  onFeaturesChange,
  disabled = false,
  isLocationSelected,
  tileSourceProvider,
  isOnline,
}: MapWrapperProps) => {
  const [mapOpen, setMapOpen] = useState(false);

  /**
   * Opens the map dialog.
   */
  const handleOpen = () => {
    if (disabled) return;
    setMapOpen(true);
  };

  /**
   * Handles save from the map dialog.
   */
  const handleSave = (newFeatures: GeoJSONFeatureCollection) => {
    onFeaturesChange(newFeatures, 'save');
  };

  /**
   * Handles close from the map dialog.
   */
  const handleClose = () => {
    setMapOpen(false);
    onFeaturesChange(
      features ?? {type: 'FeatureCollection', features: []},
      'close'
    );
  };

  return (
    <>
      {/* Trigger button/element */}
      {!isLocationSelected ? (
        // No location - show prominent button
        <Button
          variant="contained"
          fullWidth
          disabled={disabled}
          onClick={handleOpen}
          startIcon={<MapIcon />}
          sx={{
            maxWidth: 450,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 'bold',
            fontSize: '1rem',
          }}
        >
          {label}
        </Button>
      ) : (
        // Location selected - show edit button
        !disabled && (
          <Tooltip title="Edit location">
            <Box
              onClick={handleOpen}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                bgcolor: 'action.hover',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: 'action.selected',
                  transform: 'scale(1.05)',
                  boxShadow: 2,
                },
              }}
            >
              <EditIcon color="primary" fontSize="large" />
            </Box>
          </Tooltip>
        )
      )}

      {/* Map dialog */}
      <MapDialog
        open={mapOpen}
        onClose={handleClose}
        onSave={handleSave}
        featureType={featureType}
        initialFeatures={features}
        center={center}
        zoom={zoom}
        tileSourceProvider={tileSourceProvider}
        isOnline={isOnline}
      />
    </>
  );
};

export default MapWrapper;
