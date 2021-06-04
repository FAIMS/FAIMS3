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

export type TakePointProps = FieldProps & {
  onChange(evt: React.ChangeEvent<unknown>): unknown;
};

export class TakePoint extends React.Component<TakePointProps> {
  async takePoint() {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      console.debug('Take point coord', coordinates);
      const pos = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
      };
      // This is a hack! I intend to fix this by doing diffs
      // of form.values at every render instead of listening to
      // onChange, at the observation form level.
      // Hence this is a temporary workaround until staging-refactor
      // is done & merged.
      // This works because Formik.tsx's handleChange handles
      // 'eventOrPath': string | React.ChangeEvent<any>,
      // then executeChange takes a string | React.ChangeEvent<any>
      // to be compatible with 'React Native Web's onChangeText prop'
      // which provides just the value of the input
      // It uses the string as a value, so we have to setFieldValue afterwards.

      const cb: unknown = this.props.onChange(
        (this.props.field.name as unknown) as React.ChangeEvent<unknown>
      );
      (cb as (s: string) => void)('TEMPORARY VALUE');

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
