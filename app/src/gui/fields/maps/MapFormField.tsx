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

import React, {useEffect, useRef, useState} from 'react';
import './MapFormField.css';
import MapWrapper from './MapWrapper';

import {Geolocation} from '@capacitor/geolocation';
import type {GeoJSONFeatureCollection} from 'ol/format/GeoJSON';

import {FieldProps} from 'formik';
import {Alert} from '@mui/material';
import {Capacitor} from '@capacitor/core';
import {APP_NAME} from '../../../buildconfig';

// If no center is available - pass this through
const FALLBACK_CENTER = [0, 0];

export interface MapFieldProps extends FieldProps {
  label?: string;
  featureType: 'Point' | 'Polygon' | 'LineString';
  geoTiff?: string;
  projection?: string;
  center?: Array<number>;
  zoom?: number;
  FormLabelProps?: any;
}

export function MapFormField({
  field,
  form,
  ...props
}: MapFieldProps): JSX.Element {
  // State

  // center to show on map - use provided center if any
  const [center, setCenter] = useState<number[] | undefined>(props.center);

  // and a ref to track if gps center has already been requested
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
  const label = `Get ${props.featureType}`;

  const mapCallback = (theFeatures: GeoJSONFeatureCollection) => {
    setDrawnFeatures(theFeatures);
    form.setFieldValue(field.name, theFeatures, true);
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
            setNoPermission(true);
          });
      }
    };
    getCoords();
  }, []);

  let valueText = '';
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
    <div>
      <div>
        <MapWrapper
          label={label}
          featureType={featureType}
          features={drawnFeatures}
          zoom={zoom}
          center={center ?? FALLBACK_CENTER}
          callbackFn={mapCallback}
          geoTiff={props.geoTiff}
          projection={props.projection}
          setNoPermission={setNoPermission}
        />
        {noPermission && (
          <Alert severity="error" sx={{width: '100%'}}>
            {Capacitor.getPlatform() === 'web' && (
              <>
                Please enable location permissions for this page. In your
                browser, look to the left of the web address bar for a button
                that gives access to browser settings for this page.
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
        <p>{valueText}</p>
      </div>
    </div>
  );
}

//
