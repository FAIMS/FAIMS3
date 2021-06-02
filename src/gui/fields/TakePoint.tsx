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
 * Filename: TakePoint.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button from '@material-ui/core/Button';
import {Plugins} from '@capacitor/core';

const {Geolocation} = Plugins;

export class TakePoint extends React.Component<FieldProps> {
  async takePoint() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      console.debug('Take point coord', coordinates);
      const pos = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
      };
      this.props.form.setFieldValue(this.props.field.name, pos);
    } catch (err) {
      console.error(err);
      this.props.form.setFieldError(this.props.field.name, err.message);
    }
  }
  render() {
    const pos = this.props.field.value;
    const error = this.props.form.errors[this.props.field.name];
    let postext = <span>No point taken.</span>;
    if (pos !== null) {
      postext = (
        <span>
          Lat: {pos.latitude}; Long: {pos.longitude}
        </span>
      );
    }
    let error_text = <p></p>;
    if (error) {
      error_text = <p>{error}</p>;
    }
    return (
      <div>
        <Button
          variant="outlined"
          color={'primary'}
          onClick={async () => {
            await this.takePoint();
          }}
          style={{marginRight: '10px'}}
        >
          Take Point
        </Button>
        {postext}
        {error_text}
      </div>
    );
  }
}
