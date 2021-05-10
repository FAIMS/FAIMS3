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
    }
  }
  render() {
    console.error(this.props);
    return (
      <Button
        variant="contained"
        onClick={async () => {
          await this.takePoint();
        }}
      >
        Take Point
      </Button>
    );
  }
}
