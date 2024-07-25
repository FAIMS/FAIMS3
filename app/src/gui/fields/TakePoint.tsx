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
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button, {ButtonProps} from '@mui/material/Button';
import {Geolocation, Position} from '@capacitor/geolocation';
import {logError} from '../../logging';
import {FAIMSPosition} from 'faims3-datamodel';

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
}

export class TakePoint extends React.Component<
  FieldProps &
    Props &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    }
> {
  getPositionOptions() {
    return {
      // override the default capacitor setting for enableHighAccuracy as we
      // almost always want the high accuracy version, and users should only
      // opt out when they understand when it's not needed
      enableHighAccuracy: this.props.enableHighAccuracy ?? true,
      // same default as capacitor
      timeout: this.props.timeout ?? 10000, // in milliseconds
      // same default as capacitor
      maximumAge: this.props.maximumAge ?? 0, // in milliseconds
    };
  }

  async takePoint() {
    try {
      const coordinates = capacitor_coordindates_to_faims_pos(
        await Geolocation.getCurrentPosition(this.getPositionOptions())
      );
      console.debug('Take point coord', coordinates);
      this.props.form.setFieldValue(this.props.field.name, coordinates);
    } catch (err: any) {
      logError(err);
      this.props.form.setFieldError(this.props.field.name, err.message);
    }
  }
  render() {
    const pos = this.props.field.value;
    const error = this.props.form.errors[this.props.field.name];
    const instruction_text =
      this.props.instruction_text ?? 'Click to save current location';
    let positionText = <span>No point taken.</span>;
    if (pos !== null && pos !== undefined && pos.geometry !== undefined) {
      positionText = (
        <span {...this.props['ValueTextProps']}>
          Lat: {pos.geometry.coordinates[1] ?? 'Not captured'}; Long:{' '}
          {pos.geometry.coordinates[0] ?? 'Not captured'}; Acc:{' '}
          {pos.properties.accuracy ?? 'Not captured'}; Alt:{' '}
          {pos.properties.altitude ?? 'Not captured'}; AltAcc:{' '}
          {pos.properties.altitude_accuracy ?? 'Not captured'}
        </span>
      );
    }
    let error_text = <span {...this.props['NoErrorTextProps']}></span>;
    if (error) {
      error_text = (
        <span {...this.props['ErrorTextProps']}>{error.toString()}</span>
      );
    }
    return (
      <div>
        <p>
          {this.props.helperText !== undefined && this.props.helperText !== ''
            ? this.props.helperText
            : instruction_text}
        </p>
        <Button
          variant="outlined"
          color={'primary'}
          style={{marginRight: '10px'}}
          {...this.props}
          // Props from the metadata db will overwrite the above
          // style attributes, but not overwrite the below onclick.
          onClick={async () => {
            await this.takePoint();
          }}
        >
          {this.props.label !== undefined && this.props.label !== ''
            ? this.props.label
            : 'Take Point'}
        </Button>
        {positionText}
        {error_text}
      </div>
    );
  }
}

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
