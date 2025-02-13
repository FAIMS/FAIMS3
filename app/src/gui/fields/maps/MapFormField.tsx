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

import {Geolocation} from '@capacitor/geolocation';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {Box, Typography, Zoom} from '@mui/material';
import {FieldProps} from 'formik';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {useEffect, useRef, useState} from 'react';
import {useNotification} from '../../../context/popup';
import {LocationPermissionIssue} from '../../components/ui/PermissionAlerts';
import {theme} from '../../themes';
import FieldWrapper from '../fieldWrapper';
import './MapFormField.css';
import MapWrapper, {MapAction} from './MapWrapper';

// If no center is available - pass this through
// Sydney CBD
const FALLBACK_CENTER = [151.2093, -33.8688];

export interface MapFieldProps extends FieldProps {
  label?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  geoTiff?: string;
  projection?: string;
  center?: Array<number>;
  zoom?: number;
  FormLabelProps?: any;
  helperText: string;
  required: boolean;
}

export function MapFormField({
  field,
  form,
  ...props
}: MapFieldProps): JSX.Element {
  // State

  // center location of map - use provided center if any
  const [center, setCenter] = useState<number[] | undefined>(props.center);

  // and a ref to track if gps location has already been requested
  const gpsCenterRequested = useRef<boolean>(false);

  // flag set if we find we don't have location permission
  const [noPermission, setNoPermission] = useState(false);

  // Derive the features from the field value (this forces re-render anyway)
  const drawnFeatures = form.values[field.name] ?? {};

  console.log('map field props', props);
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

  // notification manager
  const notify = useNotification();

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

  useEffect(() => {
    const getCoords = async () => {
      // Always get current position on component mount - this forces a permission
      // request
      if (!gpsCenterRequested.current) {
        // Mark that we've requested already
        gpsCenterRequested.current = true;
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
          .then(result => {
            // Only store the center result if we actually need it
            if (center === undefined) {
              setCenter([result.coords.longitude, result.coords.latitude]);
            }
            // Since we use a ref to track this running, we can safely run a state
            // update here without infinite loop
            setNoPermission(false);
          })
          .catch(() => {
            notify.showWarning(
              'We were unable to access your current location. Map fields may not work as expected.'
            );
            setNoPermission(true);
          });
      }
    };
    getCoords();
  }, []);

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
  } else {
    // if no location selected update msg dynamically.
    valueText = `No ${featureLabel} selected, click above to choose one!`;
  }

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          width: '100%',
        }}
      >
        <MapWrapper
          label={label}
          featureType={featureType}
          features={drawnFeatures}
          zoom={zoom}
          center={center ?? FALLBACK_CENTER}
          fallbackCenter={center === undefined}
          setFeatures={setFeaturesCallback}
          geoTiff={props.geoTiff}
          projection={props.projection}
          setNoPermission={setNoPermission}
          isLocationSelected={isLocationSelected}
        />

        <Box
          sx={{
            alignItems: 'center',
            marginTop: 1,
            display: 'inline-flex',
            gap: '6px',
            position: 'relative',
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: 'bold',
              color: isLocationSelected
                ? theme.palette.success.main
                : theme.palette.error.main,
              transition: 'color 0.4s ease-in-out',
            }}
          >
            {valueText}
          </Typography>

          <Zoom in={isLocationSelected}>
            <CheckCircleIcon
              sx={{
                color: 'green',
                fontSize: 30,
                transition: 'transform 0.5s ease-in-out',
                transform: isLocationSelected
                  ? animateCheck
                    ? 'scale(1.3)'
                    : 'scale(1)'
                  : 'scale(0.5)',
              }}
            />
          </Zoom>

          <Zoom in={!isLocationSelected}>
            <CancelIcon
              sx={{
                color: 'red',
                fontSize: 30,
                transition: 'transform 0.5s ease-in-out',
                transform: !isLocationSelected
                  ? animateCheck
                    ? 'scale(1.3)'
                    : 'scale(1)'
                  : 'scale(0.5)',
              }}
            />
          </Zoom>
        </Box>
      </Box>

      {/*  Show error if no permission */}
      {noPermission && <LocationPermissionIssue />}
    </FieldWrapper>
  );
}
