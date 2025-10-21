/*
 * Copyright 2021, 2022 Macquarie University
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
 * Filename: TakePoint.tsx
 * Description:
 *   Implement TakePoint for entry of GPS current location
 */

import {Geolocation, Position} from '@capacitor/geolocation';
import {FAIMSPosition} from '@faims3/data-model';
import Button, {ButtonProps} from '@mui/material/Button';
import {FieldProps} from 'formik';
import React from 'react';
import {logError} from '../../logging';
import {LocationPermissionIssue} from '../components/ui/PermissionAlerts';

function capacitor_coordindates_to_faims_pos(
  coordinates: Position
): FAIMSPosition {
  const position = coordinates.coords;
  const timestamp = coordinates.timestamp;
  return {
    type: 'Feature',
    properties: {
      timestamp: timestamp,
      altitude: position.altitude ?? null,
      speed: position.speed ?? null,
      heading: position.heading ?? null,
      accuracy: position.accuracy,
      altitude_accuracy: position.altitudeAccuracy ?? null,
    },
    geometry: {
      type: 'Point',
      coordinates: [position.longitude, position.latitude],
    },
  };
}

interface Props {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  instruction_text?: string;
  helperText?: string;
  label?: string;
  disabled?: boolean;
}

export const TakePoint = (
  props: FieldProps &
    Props &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    }
) => {
  const [noPermission, setNoPermission] = React.useState(false);

  const getPositionOptions = () => {
    return {
      enableHighAccuracy: props.enableHighAccuracy ?? true,
      timeout: props.timeout ?? 10000,
      maximumAge: props.maximumAge ?? 0,
    };
  };

  const takePoint = async () => {
    try {
      const coordinates = capacitor_coordindates_to_faims_pos(
        await Geolocation.getCurrentPosition(getPositionOptions())
      );
      props.form.setFieldValue(props.field.name, coordinates, true);
    } catch (err: any) {
      logError(err);
      setNoPermission(true);
      props.form.setFieldError(props.field.name, err.message);
    }
  };

  const pos = props.field.value;
  const error = props.form.errors[props.field.name];

  let positionText;
  if (pos !== null && pos !== undefined && pos.geometry !== undefined) {
    positionText = (
      <span {...props.ValueTextProps}>
        Lat: {pos.geometry.coordinates[1] ?? 'Not captured'}; Long:{' '}
        {pos.geometry.coordinates[0] ?? 'Not captured'}; Acc:{' '}
        {pos.properties.accuracy ?? 'Not captured'}; Alt:{' '}
        {pos.properties.altitude ?? 'Not captured'}; AltAcc:{' '}
        {pos.properties.altitude_accuracy ?? 'Not captured'}
      </span>
    );
  }

  let error_text = <span {...props.NoErrorTextProps}></span>;
  if (error) {
    error_text = <span {...props['ErrorTextProps']}>{error.toString()}</span>;
  }

  return (
    <div>
      <p>{props.helperText || 'Click to save current location'}</p>
      <Button
        variant="outlined"
        fullWidth={true}
        color={'primary'}
        style={{marginRight: '10px'}}
        disabled={props.disabled}
        onClick={async () => {
          await takePoint();
        }}
      >
        {props.label || 'Take Point'}
      </Button>
      {positionText}
      {error_text}
      {noPermission && <LocationPermissionIssue />}
    </div>
  );
};

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'TakePoint',
//   'type-returned': 'faims-pos::Location', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     name: 'take-point-field',
//     id: 'take-point-field',
//     helperText: 'Click to save current location',
//     variant: 'outlined',
//     label: 'Take point',
//   },
//   validationSchema: [['yup.object'], ['yup.nullable']],
//   initialValue: null,
// };
