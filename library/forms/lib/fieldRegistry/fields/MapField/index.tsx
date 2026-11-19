// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Implement MapFormField for entry of data via maps
 */

import {Geolocation} from '@capacitor/geolocation';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import {Alert, Box, Button, Paper, Typography, useTheme} from '@mui/material';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {useContext, useEffect, useState} from 'react';
import {z} from 'zod';
import {schemaWithAbsent} from '../../../validationModule/readableErrors';
import {ContextualMapLayersContext} from '../../../components/maps/contextualMapLayers';
import {createTileStore} from '../../../components/maps/tileDB/TileStore';
import {GeoJSONFeatureCollectionSchema} from '../../../components/maps/types';
import {useIsOnline} from '../../../components/maps/useIsOnline';
import {LocationPermissionIssue} from '../../../components/PermissionAlerts';
import {FullFieldProps} from '../../../formModule/types';
import {MapRenderer} from '../../../rendering/fields/view/specialised/Mapping';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import MapWrapper, {MapAction} from './MapWrapper';
import {logError} from '../../../logging';

export const MapFieldPropsSchema = z.object({
  label: z.string().optional(),
  buttonLabelText: z.string().optional(),
  featureType: z.enum(['Point', 'Polygon', 'LineString']).optional(),
  allowSetToCurrentPoint: z.boolean().optional().default(false),
  geoTiff: z.string().optional(),
  projection: z.string().optional(),
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().optional(),
});

export type MapFieldProps = z.infer<typeof MapFieldPropsSchema>;
type FieldProps = MapFieldProps & FullFieldProps;

const createPointFeature = (
  center: [number, number]
): GeoJSONFeatureCollection => {
  return {
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
  };
};

export function MapFormField(props: FieldProps): JSX.Element {
  const [canShowMap, setCanShowMap] = useState(true);

  const theme = useTheme();
  const isOnline = useIsOnline();
  const {layers: contextualLayers} = useContext(ContextualMapLayersContext);

  const mapConfig = props.config.mapConfig();

  const appName =
    props.config.mode === 'full' ? props.config.appName : 'FAIMS3';

  // flag set if we find we don't have location permission
  const [noPermission, setNoPermission] = useState(false);

  // Derive the features from the field value
  const drawnFeatures = (props.state.value?.data || undefined) as
    | GeoJSONFeatureCollection
    | undefined;

  // Default zoom level
  const zoom = typeof props.zoom === 'number' ? props.zoom : 14;

  // default to point if not specified
  const featureType = props.featureType ?? 'Point';

  // Map featureType to user-friendly label
  const featureTypeLabel: Record<string, string> = {
    Point: 'Point',
    LineString: 'Line',
    Polygon: 'Polygon',
  };

  // Button label: use buttonLabelText if provided, otherwise fall back to label or default
  const buttonLabel =
    props.buttonLabelText ??
    props.label ??
    `Select ${featureTypeLabel[featureType] ?? featureType}`;

  // A location is selected if there are features provided
  const isLocationSelected =
    drawnFeatures !== undefined &&
    drawnFeatures.features &&
    drawnFeatures.features.length > 0;

  /**
   * Offline map edits are available when any offline map region or downloaded
   * map layer exists on the device. Location overlap is not required.
   */
  useEffect(() => {
    let cancelled = false;

    const checkCanShowMap = async () => {
      if (isOnline || contextualLayers.length > 0) {
        if (!cancelled) setCanShowMap(true);
        return;
      }

      try {
        const tileStore = createTileStore(mapConfig);
        const tileSets = await tileStore.getTileSets();
        if (!cancelled) setCanShowMap((tileSets?.length ?? 0) > 0);
      } catch {
        if (!cancelled) setCanShowMap(false);
      }
    };

    void checkCanShowMap();
    return () => {
      cancelled = true;
    };
  }, [isOnline, contextualLayers.length]);

  // Callback function when a location is selected
  const setFeaturesCallback = (
    theFeatures: GeoJSONFeatureCollection | null,
    action: MapAction
  ) => {
    if (action === 'save') {
      props.setFieldData(theFeatures);
    }
  };

  // User wants to use the current location as input, so go get it now
  // and set the value of this field
  const handleCurrentLocation = () => {
    // get current location and set as point feature
    Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000, // Longer timeout for accuracy
      maximumAge: 0, // Force fresh position
    })
      .then(point => {
        // set the field value to a point feature at this location
        // we use lodash get here to avoid issues if form.values or field.name are undefined
        const center: [number, number] = [
          point.coords.longitude,
          point.coords.latitude,
        ];
        const pointFeature = createPointFeature(center);
        props.setFieldData(pointFeature);
      })
      .catch(error => {
        logError(new Error('Failed to get current location:'), {error});
        setNoPermission(true);
      });
  };

  const mapWrapperEl = (
    <MapWrapper
      config={mapConfig}
      label={buttonLabel}
      featureType={featureType}
      features={drawnFeatures}
      zoom={zoom}
      center={props.center}
      setFeatures={setFeaturesCallback}
      geoTiff={props.geoTiff}
      projection={props.projection}
      setNoPermission={setNoPermission}
      isLocationSelected={isLocationSelected}
      disabled={props.disabled}
      allowSetToCurrentPoint={props.allowSetToCurrentPoint}
      includeRecordLayers={props.config.mode === 'full'}
      excludeRecordId={
        props.config.mode === 'full' ? props.config.recordId : undefined
      }
    />
  );

  const locationChip = isLocationSelected ? (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flex: {xs: 1, md: '0 1 auto'},
        minWidth: {xs: 0, md: 'auto'},
        backgroundColor: theme.palette.success.light + '20',
        borderColor: theme.palette.success.main,
      }}
    >
      <CheckCircleOutlined
        color="success"
        fontSize="small"
        sx={{flexShrink: 0}}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          minWidth: {xs: 0, md: 'auto'},
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {featureType === 'Point' && drawnFeatures?.features?.[0]?.geometry
          ? `Location: ${(
              drawnFeatures.features[0].geometry as {
                coordinates: number[];
              }
            ).coordinates[1].toFixed(5)}, ${(
              drawnFeatures.features[0].geometry as {
                coordinates: number[];
              }
            ).coordinates[0].toFixed(5)}`
          : `${featureType} captured (${
              drawnFeatures?.features?.length ?? 0
            } feature${
              (drawnFeatures?.features?.length ?? 0) !== 1 ? 's' : ''
            })`}
      </Typography>
    </Paper>
  ) : null;

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      {/* if offline and nothing is downloaded, offer GPS for point features */}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          width: '100%',
        }}
      >
        {!canShowMap ? (
          <>
            {featureType === 'Point' && (
              <>
                <Alert variant="outlined" severity="warning">
                  The interactive map is not available while <b>offline</b> and
                  there is no downloaded map or map layer on this device. Use
                  the button below to submit your current GPS location.
                </Alert>
                <Button
                  variant="outlined"
                  onClick={handleCurrentLocation}
                  disabled={props.disabled}
                >
                  Use my current location
                </Button>
              </>
            )}
            {featureType !== 'Point' && (
              <>
                <Alert variant="outlined" severity="warning">
                  The interactive map is not available while <b>offline</b> and
                  there is no downloaded map or map layer on this device.
                </Alert>
              </>
            )}
            {locationChip && <Box sx={{marginTop: 0.8}}>{locationChip}</Box>}
          </>
        ) : isLocationSelected ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(1.5),
              width: {xs: '100%', md: 'fit-content'},
              maxWidth: '100%',
            }}
          >
            {locationChip}
            {mapWrapperEl}
          </Box>
        ) : (
          mapWrapperEl
        )}
      </Box>

      {/*  Show error if no permission */}
      {noPermission && <LocationPermissionIssue appName={appName} />}
    </FieldWrapper>
  );
}

/**
 * Generates a Zod schema for field value validation.
 *
 * The value is a GeoJSON FeatureCollection. When required, it must
 * contain at least one feature.
 */
const valueSchemaFunction = (props: FieldProps) => {
  const present = schemaWithAbsent(
    null,
    GeoJSONFeatureCollectionSchema.nullable()
  );

  if (props.required) {
    return present.refine(
      val => !!val && Array.isArray(val.features) && val.features.length > 0,
      {message: 'A location selection is required.'}
    );
  }

  return present;
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Export a constant with the information required to register this field type
 */
export const mapFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'mapping-plugin',
  name: 'MapFormField',
  returns: 'faims-core::JSON',
  component: MapFormField,
  fieldPropsSchema: MapFieldPropsSchema,
  fieldDataSchemaFunction: valueSchemaFunction,
  view: {component: MapRenderer, config: {}},
};
