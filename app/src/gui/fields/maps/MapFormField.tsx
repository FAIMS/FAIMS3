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

import {useEffect, useRef, useState} from 'react';
import './MapFormField.css';
import MapWrapper from './MapWrapper';
import {Geolocation} from '@capacitor/geolocation';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';
import {FieldProps} from 'formik';
import {
  Alert,
  Box,
  Button,
  Typography,
  useMediaQuery,
  useTheme,
  Zoom,
} from '@mui/material';
import {Capacitor} from '@capacitor/core';
import {APP_NAME} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import FieldWrapper from '../fieldWrapper';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MapIcon from '@mui/icons-material/Map';
import {theme} from '../../themes';

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

  // Use form value as default field features - otherwise empty {}
  const [drawnFeatures, setDrawnFeatures] = useState<GeoJSONFeatureCollection>(
    form.values[field.name] ?? {}
  );

  // Default zoom level
  const zoom = props.zoom ?? 14;

  // default to point if not specified
  const featureType = props.featureType ?? 'Point';

  // default label
  const label = props.label ?? `Get ${props.featureType}`;

  // state for visual indicators
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showCross, setShowCross] = useState(false);
  const [animateCheck, setAnimateCheck] = useState(false);
  const [hasSavedLocation, setHasSavedLocation] = useState(false);
  // notification manager
  const notify = useNotification();

  // Callback function when a location is selected
  const mapCallback = (
    theFeatures: GeoJSONFeatureCollection,
    action?: 'save' | 'clear' | 'close'
  ) => {
    if (action === 'save') {
      setDrawnFeatures(theFeatures);
      form.setFieldValue(field.name, theFeatures, true);
      setIsLocationSelected(true);
      setShowCross(false);
      setShowCheckmark(true);
      setHasSavedLocation(true);
      setAnimateCheck(true);
      notify.showSuccess('Location successfully selected!');
      setTimeout(() => setAnimateCheck(false), 1200);
    } else if (action === 'clear') {
      setDrawnFeatures({});
      form.setFieldValue(field.name, {}, true);
      setIsLocationSelected(false);
      setShowCheckmark(false);
      setShowCross(true);
      setHasSavedLocation(false);
      setAnimateCheck(true);
      notify.showWarning('Location selection cleared.');
      setTimeout(() => setAnimateCheck(false), 1200);
    } else if (action === 'close') {
      if (!hasSavedLocation) {
        // Only show corss if no location was ever saved
        setShowCross(true);
      }
      setShowCheckmark(false);
      setAnimateCheck(true);
      notify.showError('Location selection was cancelled.');
      setTimeout(() => setAnimateCheck(false), 1200);
    }
  };

  useEffect(() => {
    const getCoords = async () => {
      // Always get current position on component mount - this forces a permission
      // request
      if (!gpsCenterRequested.current) {
        // Mark that we've requested already
        gpsCenterRequested.current = true;
        Geolocation.getCurrentPosition()
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
  }

  return (
    <FieldWrapper
      heading="Location"
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
        {/* Map Interaction */}
        <MapWrapper
          label={label}
          featureType={featureType}
          features={drawnFeatures}
          zoom={zoom}
          center={center ?? FALLBACK_CENTER}
          fallbackCenter={center === undefined}
          callbackFn={mapCallback}
          geoTiff={props.geoTiff}
          projection={props.projection}
          setNoPermission={setNoPermission}
        />

        {/* Status Icons with Animation */}
        <Box sx={{display: 'flex', alignItems: 'center', marginTop: 1}}>
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
            {isLocationSelected
              ? valueText
              : 'No location selected, click above to choose a point!'}
          </Typography>

          <Zoom in={showCheckmark}>
            <CheckCircleIcon
              sx={{
                color: 'green',
                fontSize: 30,
                marginLeft: 2,
                transition: 'transform 0.5s ease-in-out',
                transform: showCheckmark
                  ? animateCheck
                    ? 'scale(1.3)'
                    : 'scale(1)'
                  : 'scale(0.5)',
              }}
            />
          </Zoom>

          <Zoom in={showCross}>
            <CancelIcon
              sx={{
                color: 'red',
                fontSize: 30,
                transition: 'transform 0.5s ease-in-out',
                transform: showCross
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
      {noPermission && (
        <Alert severity="error" sx={{width: '100%', marginTop: 1}}>
          {Capacitor.getPlatform() === 'web' && (
            <>
              Please enable location permissions for this page. In your browser,
              look to the left of the web address bar for a button that gives
              access to browser settings for this page.
            </>
          )}
          {Capacitor.getPlatform() === 'android' && (
            <>
              Please enable location permissions for {APP_NAME}. Go to your
              device Settings &gt; Apps &gt; {APP_NAME} &gt; Permissions &gt;
              Location and select "Allow all the time" or "Allow only while
              using the app".
            </>
          )}
          {Capacitor.getPlatform() === 'ios' && (
            <>
              Please enable location permissions for {APP_NAME}. Go to your
              device Settings &gt; Privacy & Security &gt; Location Services
              &gt;
              {APP_NAME} and select "While Using the App".
            </>
          )}
        </Alert>
      )}
    </FieldWrapper>
  );
}
