import React from 'react';
import {FieldProps} from 'formik';
import Button from '@material-ui/core/Button';

export class ActionButton extends React.Component<FieldProps> {
  clickThis() {
    this.props.form.setFieldValue(this.props.field.name, 'Change!');
  }
  render() {
    return (
      <Button
        variant="contained"
        onClick={() => {
          this.clickThis();
        }}
      >
        Action!
      </Button>
    );
  }
}
