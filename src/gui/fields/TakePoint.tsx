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
    console.error(this.props);
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
          variant="contained"
          onClick={async () => {
            await this.takePoint();
          }}
        >
          Take Point
        </Button>
        {postext}
        {error_text}
      </div>
    );
  }
}
