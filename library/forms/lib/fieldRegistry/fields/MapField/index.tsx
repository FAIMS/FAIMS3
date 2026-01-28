/*
 * Copyright 2021 Macquarie University
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
 *   Implement MapFormField for entry of data via maps
 */

import {Geolocation} from '@capacitor/geolocation';
import {CheckCircleOutline} from '@mui/icons-material';
import {Alert, Box, Button, Paper, Typography, useTheme} from '@mui/material';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import GeoJSON from 'ol/format/GeoJSON';
import {useEffect, useState} from 'react';
import {z} from 'zod';
import {createTileStore} from '../../../components';
import {defaultMapProjection} from '../../../components/maps/MapComponent';
import {GeoJSONFeatureCollectionSchema} from '../../../components/maps/types';
import {LocationPermissionIssue} from '../../../components/PermissionAlerts';
import {FullFieldProps} from '../../../formModule/types';
import {MapRenderer} from '../../../rendering/fields/view/specialised/Mapping';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import MapWrapper, {MapAction} from './MapWrapper';

const MapFieldPropsSchema = z.object({
  label: z.string().optional(),
  buttonLabelText: z.string().optional(),
  featureType: z.enum(['Point', 'Polygon', 'LineString']).optional(),
  allowSetToCurrentPoint: z.boolean().optional().default(false),
  geoTiff: z.string().optional(),
  projection: z.string().optional(),
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().optional(),
});

type MapFieldProps = z.infer<typeof MapFieldPropsSchema>;
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
   * canShowMapNear - can we show a map near this location?
   *
   * Return true if we are online or if we have a cached map that includes
   * the center location.
   */
  const canShowMapNear = async (
    features: GeoJSONFeatureCollection | undefined
  ) => {
    if (navigator.onLine) return true;

    if (features) {
      const geoJson = new GeoJSON();
      const parsedFeatures = geoJson.readFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: defaultMapProjection,
      });

      // now work out if we have a stored map
      const tileStore = createTileStore(mapConfig);
      return await tileStore.mapCacheIncludes(parsedFeatures);
    } else {
      return false;
    }
  };

  // when the center changes, check if we can show this map
  useEffect(() => {
    if (isLocationSelected) {
      // can we draw a map around the drawn features?
      canShowMapNear(drawnFeatures).then(flag => setCanShowMap(flag));
    } else if (props.center) {
      // can we draw a map around the configured center
      canShowMapNear(createPointFeature(props.center)).then(flag =>
        setCanShowMap(flag)
      );
    }
  }, [props.center, drawnFeatures]);

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
        console.error('Failed to get current location:', error);
        setNoPermission(true);
      });
  };

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      {/* if offline and no downloaded map, offer to use current location for point features only */}

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
                  and there is no downloaded map covering this location. Use the
                  button below to submit your current GPS location.
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
                  and there is no downloaded map covering this location.
                </Alert>
              </>
            )}
          </>
        ) : (
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
          />
        )}
        <Box
          sx={{
            alignItems: 'center',
            marginTop: 0.8,
            display: 'inline-flex',
            gap: theme.spacing(1),
          }}
        >
          {isLocationSelected && (
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: theme.palette.success.light + '20',
                borderColor: theme.palette.success.main,
              }}
            >
              <CheckCircleOutline color="success" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                {featureType === 'Point' &&
                drawnFeatures?.features?.[0]?.geometry
                  ? `Location selected: ${(
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
          )}
        </Box>
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
