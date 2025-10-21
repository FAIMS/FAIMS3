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
 * Filename: MapFormField.tsx
 * Description:
 *   Implement MapFormField for entry of data via maps in FAIMS
 */

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {Alert, Box, Button, Typography} from '@mui/material';
import {FieldProps} from 'formik';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {useEffect, useState} from 'react';
import {Geolocation} from '@capacitor/geolocation';
import {canShowMapNear} from '../../components/map/map-component';
import {LocationPermissionIssue} from '../../components/ui/PermissionAlerts';
import {theme} from '../../themes';
import FieldWrapper from '../fieldWrapper';
import MapWrapper, {MapAction} from './MapWrapper';

export interface MapFieldProps extends FieldProps {
  label?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  geoTiff?: string;
  projection?: string;
  center?: [number, number];
  zoom?: number;
  FormLabelProps?: any;
  helperText: string;
  required: boolean;
  advancedHelperText?: string;
  disabled?: boolean;
}

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

export function MapFormField({
  field,
  form,
  ...props
}: MapFieldProps): JSX.Element {
  const [canShowMap, setCanShowMap] = useState(false);

  // flag set if we find we don't have location permission
  const [noPermission, setNoPermission] = useState(false);

  // Derive the features from the field value (this forces re-render anyway)
  const drawnFeatures = form.values[field.name] ?? {};

  // Default zoom level
  const zoom = typeof props.zoom === 'number' ? props.zoom : 14;

  // default to point if not specified
  const featureType = props.featureType ?? 'Point';

  // default label
  const label = props.label ?? `Get ${props.featureType}`;

  // A location is selected if there are features provided
  const isLocationSelected =
    drawnFeatures.features && drawnFeatures.features.length > 0;

  // state for visual indicators
  const [animateCheck, setAnimateCheck] = useState(false);

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
    theFeatures: GeoJSONFeatureCollection,
    action: MapAction
  ) => {
    if (action === 'save') {
      form.setFieldValue(field.name, theFeatures, true);
      setAnimateCheck(true);
      setTimeout(() => setAnimateCheck(false), 1000);
    } else if (action === 'close') {
      setAnimateCheck(true);
      setTimeout(() => setAnimateCheck(false), 1000);
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
        form.setFieldValue(field.name, pointFeature, true);
      })
      .catch(error => {
        console.error('Failed to get current location:', error);
        setNoPermission(true);
      });
  };

  // dynamically determine feature label based on featureType
  const featureLabel =
    props.featureType === 'Polygon'
      ? 'polygon'
      : props.featureType === 'LineString'
        ? 'line'
        : 'point';

  let valueText = 'No location selected';
  if (drawnFeatures.features && drawnFeatures.features.length > 0) {
    const geom = drawnFeatures.features[0].geometry;
    switch (geom.type) {
      case 'Point':
        valueText =
          'Point: ' +
          geom.coordinates[0].toFixed(2).toString() +
          ', ' +
          geom.coordinates[1].toFixed(2).toString();
        break;
      case 'Polygon':
        valueText = 'Polygon: ' + (geom.coordinates[0].length - 1) + ' points';
        break;
      case 'LineString':
        valueText = 'Line String: ' + geom.coordinates.length + ' points';
        break;
    }
  } else if (canShowMap) {
    valueText = `No ${featureLabel} selected, click above to choose one!`;
  } else {
    // if no location selected update msg dynamically.
    valueText = `No ${featureLabel} selected.`;
  }

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
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
            label={label}
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
          {isLocationSelected ? (
            <CheckCircleIcon
              sx={{
                color: 'green',
                fontSize: 20,
                transition: 'transform 0.5s ease-in-out',
                transform: isLocationSelected
                  ? animateCheck
                    ? 'scale(1.3)'
                    : 'scale(1)'
                  : 'scale(0.5)',
              }}
            />
          ) : (
            <CancelIcon
              sx={{
                color: 'red',
                fontSize: 20,
                transition: 'transform 0.5s ease-in-out',
                transform: !isLocationSelected
                  ? animateCheck
                    ? 'scale(1.3)'
                    : 'scale(1)'
                  : 'scale(0.5)',
              }}
            />
          )}

          <Typography
            variant="body2"
            sx={{
              fontWeight: 'bold',
              color: isLocationSelected
                ? theme.palette.success.main
                : theme.palette.error.light,
              transition: 'color 0.4s ease-in-out',
            }}
          >
            {valueText}
          </Typography>
        </Box>
      </Box>

      {/*  Show error if no permission */}
      {noPermission && <LocationPermissionIssue />}
    </FieldWrapper>
  );
}
