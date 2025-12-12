/**
 * MapFormField.tsx
 *
 * A form field for capturing geographic data (points, polygons, lines) via
 * an interactive OpenLayers map. Supports:
 *
 * - Point, Polygon, and LineString geometry types
 * - Offline map support via injected tile source provider
 * - GPS-based "use current location" fallback when offline
 * - Preview mode rendering for form builder contexts
 *
 * ## Architecture
 *
 * The field uses dependency injection for tile sources to support offline
 * caching. In full mode, the `TileSourceProvider` is pulled from the form
 * config. In preview mode, a simple placeholder is rendered.
 */

import {Geolocation} from '@capacitor/geolocation';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MapIcon from '@mui/icons-material/LocationOn';
import {Alert, Box, Button, Paper, Typography} from '@mui/material';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {useEffect, useMemo, useState} from 'react';
import {z} from 'zod';
import {FullFormManagerConfig} from '../../../formModule';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {DefaultTileSourceProvider, canShowMapNear} from '../../../maps';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import MapWrapper, {MapAction, MapFeatureType} from '../wrappers/MapWrapper';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ZOOM = 14;
const WGS84_PROJECTION = 'EPSG:4326';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Schema for the GeoJSON geometry object.
 * Validates the structure without being overly strict on coordinate formats.
 */
const GeoJSONGeometrySchema = z.object({
  type: z.enum(['Point', 'Polygon', 'LineString']),
  coordinates: z.any(), // Coordinate validation is complex; keep flexible
});

/**
 * Schema for a single GeoJSON feature.
 */
const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeoJSONGeometrySchema,
  properties: z.any().nullable(),
});

/**
 * Schema for the field value - a GeoJSON FeatureCollection.
 */
const GeoJSONFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureSchema),
});

/**
 * Field-specific props schema extending the base field props.
 */
const MapFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Geometry type to draw: Point, Polygon, or LineString */
  featureType: z
    .enum(['Point', 'Polygon', 'LineString'])
    .optional()
    .default('Point'),
  /** Initial map center in [longitude, latitude] */
  center: z.tuple([z.number(), z.number()]).optional(),
  /** Initial zoom level (0-20) */
  zoom: z.number().min(0).max(20).optional().default(DEFAULT_ZOOM),
  /** URL to a GeoTIFF overlay (optional) */
  geoTiff: z.string().optional(),
  /** Projection for GeoTIFF overlay */
  projection: z.string().optional(),
});

type MapFieldProps = z.infer<typeof MapFieldPropsSchema>;

/** Combined props for the field component */
type MapFieldComponentProps = MapFieldProps & FormFieldContextProps;

/** Props for the full mode implementation */
interface FullMapFieldProps extends MapFieldComponentProps {
  config: FullFormManagerConfig;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a GeoJSON FeatureCollection containing a single point.
 */
const createPointFeature = (
  center: [number, number]
): GeoJSONFeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: center,
      },
      properties: null,
    },
  ],
});

/**
 * Generates a human-readable description of the current value.
 */
const getValueDescription = (
  features: GeoJSONFeatureCollection | undefined,
  featureType: MapFeatureType,
  canShowMap: boolean
): string => {
  const featureLabel =
    featureType === 'Polygon'
      ? 'polygon'
      : featureType === 'LineString'
        ? 'line'
        : 'point';

  if (!features?.features?.length) {
    return canShowMap
      ? `No ${featureLabel} selected, click above to choose one!`
      : `No ${featureLabel} selected.`;
  }

  const geom = features.features[0].geometry;

  switch (geom.type) {
    case 'Point':
      return `Point: ${geom.coordinates[0].toFixed(
        2
      )}, ${geom.coordinates[1].toFixed(2)}`;
    case 'Polygon':
      return `Polygon: ${geom.coordinates[0].length - 1} points`;
    case 'LineString':
      return `Line: ${geom.coordinates.length} points`;
    default:
      return 'Location selected';
  }
};

// ============================================================================
// Preview Mode Component
// ============================================================================

/**
 * Simple placeholder shown in preview/form-builder mode.
 */
const MapFieldPreview = ({label, featureType}: MapFieldProps) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'action.hover',
      }}
    >
      <MapIcon sx={{fontSize: 48, color: 'action.disabled'}} />
      <Typography variant="body2" color="text.secondary">
        {label || 'Map Field'} ({featureType || 'Point'})
      </Typography>
      <Typography variant="caption" color="text.disabled">
        Interactive map available in full mode
      </Typography>
    </Paper>
  );
};

// ============================================================================
// Full Mode Component
// ============================================================================

/**
 * The full map field implementation with all functionality.
 */
const FullMapField = (props: FullMapFieldProps) => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    featureType = 'Point',
    center,
    zoom = DEFAULT_ZOOM,
    disabled,
    state,
    setFieldData,
    config,
  } = props;

  // Parse current value
  const rawValue = state.value?.data;
  const currentFeatures = useMemo(() => {
    const parsed = GeoJSONFeatureCollectionSchema.safeParse(rawValue);
    return parsed.success ? parsed.data : undefined;
  }, [rawValue]);

  const isLocationSelected = (currentFeatures?.features?.length ?? 0) > 0;

  // State
  const [canShowMap, setCanShowMap] = useState(false);
  const [noPermission, setNoPermission] = useState(false);
  const [saveAnimation, setSaveAnimation] = useState(false);

  // Get tile provider from config or use default
  const tileSourceProvider =
    config.tileSourceProvider ?? DefaultTileSourceProvider;

  const isOnline = props.config.isOnline ?? navigator.onLine;

  // Check if we can show the map (online or have cached tiles)
  useEffect(() => {
    const checkMapAvailability = async () => {
      if (isLocationSelected && currentFeatures) {
        const canShow = await canShowMapNear(
          currentFeatures,
          tileSourceProvider,
          isOnline
        );
        setCanShowMap(canShow);
      } else if (center) {
        const canShow = await canShowMapNear(
          createPointFeature(center),
          tileSourceProvider,
          isOnline
        );
        setCanShowMap(canShow);
      } else {
        // No center and no features - can show if online
        setCanShowMap(isOnline);
      }
    };

    checkMapAvailability();
  }, [
    center,
    currentFeatures,
    isLocationSelected,
    tileSourceProvider,
    isOnline,
  ]);

  /**
   * Handles feature changes from MapWrapper.
   */
  const handleFeaturesChange = (
    features: GeoJSONFeatureCollection,
    action: MapAction
  ) => {
    if (action === 'save') {
      setFieldData(features);
      setSaveAnimation(true);
      setTimeout(() => setSaveAnimation(false), 1000);
    }
  };

  /**
   * Uses current GPS location as a point feature.
   */
  const handleUseCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const pointFeature = createPointFeature([
        position.coords.longitude,
        position.coords.latitude,
      ]);

      setFieldData(pointFeature);
      setSaveAnimation(true);
      setTimeout(() => setSaveAnimation(false), 1000);
    } catch (error) {
      console.error('Failed to get current location:', error);
      setNoPermission(true);
    }
  };

  const valueDescription = getValueDescription(
    currentFeatures,
    featureType,
    canShowMap
  );

  const featureLabel =
    featureType === 'Polygon'
      ? 'polygon'
      : featureType === 'LineString'
        ? 'line'
        : 'point';

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={state.meta.errors as unknown as string[]}
    >
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
        {/* Map not available offline warning + fallback */}
        {!canShowMap ? (
          <>
            <Alert severity="warning" variant="outlined">
              The interactive map is not available while{' '}
              <strong>offline</strong> and there is no downloaded map covering
              this location.
              {featureType === 'Point' &&
                ' Use the button below to submit your current GPS location.'}
            </Alert>

            {featureType === 'Point' && (
              <Button
                variant="outlined"
                onClick={handleUseCurrentLocation}
                disabled={disabled}
                startIcon={<MapIcon />}
              >
                Use my current location
              </Button>
            )}
          </>
        ) : (
          /* Map available - render MapWrapper */
          <MapWrapper
            label={label || `Select ${featureLabel}`}
            features={currentFeatures}
            featureType={featureType}
            zoom={zoom}
            center={center}
            onFeaturesChange={handleFeaturesChange}
            disabled={disabled}
            isLocationSelected={isLocationSelected}
            tileSourceProvider={tileSourceProvider}
            isOnline={isOnline}
          />
        )}

        {/* Value status indicator */}
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          {isLocationSelected ? (
            <CheckCircleIcon
              sx={{
                color: 'success.main',
                fontSize: 20,
                transition: 'transform 0.3s',
                transform: saveAnimation ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ) : (
            <CancelIcon
              sx={{
                color: 'error.main',
                fontSize: 20,
              }}
            />
          )}
          <Typography
            variant="body2"
            fontWeight="medium"
            color={isLocationSelected ? 'success.main' : 'error.main'}
          >
            {valueDescription}
          </Typography>
        </Box>

        {/* Permission error */}
        {noPermission && (
          <Alert severity="error" onClose={() => setNoPermission(false)}>
            Location permission denied. Please enable location access in your
            device settings to use this feature.
          </Alert>
        )}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Main Field Component (Mode Router)
// ============================================================================

/**
 * MapFormField - routes to preview or full implementation based on mode.
 */
const MapFormField = (props: MapFieldComponentProps) => {
  if (props.config.mode === 'preview') {
    return <MapFieldPreview {...(props as MapFieldProps)} />;
  }

  return <FullMapField {...(props as FullMapFieldProps)} />;
};

// ============================================================================
// Value Schema
// ============================================================================

/**
 * Generates a Zod schema for field value validation.
 *
 * The value is a GeoJSON FeatureCollection. When required, it must
 * contain at least one feature.
 */
const valueSchemaFunction = (props: MapFieldProps) => {
  const baseSchema = GeoJSONFeatureCollectionSchema;

  if (props.required) {
    return baseSchema.refine(val => val.features && val.features.length > 0, {
      message: 'A location selection is required.',
    });
  }

  // Optional - allow undefined/null or valid schema
  return baseSchema.optional().nullable();
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Field specification for registration with the field registry.
 */
export const mapFormFieldSpec: FieldInfo<MapFieldComponentProps> = {
  namespace: 'mapping-plugin',
  name: 'MapFormField',
  returns: 'faims-core::JSON',
  component: MapFormField,
  fieldPropsSchema: MapFieldPropsSchema,
  fieldDataSchemaFunction: valueSchemaFunction,
  view: {
    component: ({value}) => {
      const features = value as GeoJSONFeatureCollection | undefined;
      const description = getValueDescription(features, 'Point', false);
      return <Typography variant="body2">{description}</Typography>;
    },
    config: {},
    attributes: {singleColumn: true},
  },
};

export default MapFormField;
