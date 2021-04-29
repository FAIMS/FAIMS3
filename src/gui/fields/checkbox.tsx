import React from 'react';
import MuiCheckbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import {
  FormControlLabel,
  FormHelperText,
  FormHelperTextProps,
  FormControlLabelProps,
} from '@material-ui/core';
import {fieldToCheckbox, CheckboxProps} from 'formik-material-ui';

interface Props {
  FormControlLabelProps: FormControlLabelProps;
  FormHelperTextProps: FormHelperTextProps;
}

export class Checkbox extends React.Component<CheckboxProps & Props> {
  render() {
    const {
      FormControlLabelProps,
      FormHelperTextProps,
      ...checkboxWithLabelProps
    } = this.props;

    let error = false;
    if (
      checkboxWithLabelProps.form.errors[checkboxWithLabelProps.field.name] &&
      checkboxWithLabelProps.form.touched[checkboxWithLabelProps.field.name]
    ) {
      error = true;
    }

    return (
      <FormControl error={error}>
        <FormControlLabel
          {...FormControlLabelProps}
          control={
            <MuiCheckbox
              {...fieldToCheckbox(checkboxWithLabelProps)}
              checked={checkboxWithLabelProps.field.value}
            />
          }
        />
        {error ? (
          <FormHelperText
            children={
              checkboxWithLabelProps.form.errors[
                checkboxWithLabelProps.field.name
              ]
            }
          />
        ) : (
          <FormHelperText {...FormHelperTextProps} />
        )}
      </FormControl>
    );
  }
}
