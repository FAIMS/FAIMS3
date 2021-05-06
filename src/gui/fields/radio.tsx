import React from 'react';
import MuiRadioGroup from '@material-ui/core/RadioGroup';
import MuiRadio from '@material-ui/core/Radio';
import FormControl from '@material-ui/core/FormControl';
import {
  FormLabel,
  FormControlLabel,
  FormHelperText,
  FormLabelProps,
  FormHelperTextProps,
} from '@material-ui/core';
import {fieldToRadioGroup, RadioGroupProps} from 'formik-material-ui';

interface option {
  key: string;
  value: string;
  label: string;
}

interface ElementProps {
  options: Array<option>;
}

interface Props {
  FormLabelProps: FormLabelProps;
  FormHelperTextProps: FormHelperTextProps;
  ElementProps: ElementProps;
}

export class RadioGroup extends React.Component<RadioGroupProps & Props> {
  render() {
    const {
      ElementProps,
      FormLabelProps,
      FormHelperTextProps,

      ...radioGroupProps
    } = this.props;

    let error = false;
    if (
      radioGroupProps.form.errors[radioGroupProps.field.name] &&
      radioGroupProps.form.touched[radioGroupProps.field.name]
    ) {
      error = true;
    }

    return (
      <FormControl error={error}>
        <FormLabel {...FormLabelProps} />
        <MuiRadioGroup {...fieldToRadioGroup(radioGroupProps)}>
          {ElementProps.options.map(option => (
            <FormControlLabel
              key={option.key ? option.key : option.value}
              value={option.value}
              control={<MuiRadio />}
              label={option.label}
            />
          ))}
        </MuiRadioGroup>
        {error ? (
          <FormHelperText
            children={radioGroupProps.form.errors[radioGroupProps.field.name]}
          />
        ) : (
          <FormHelperText {...FormHelperTextProps} />
        )}
      </FormControl>
    );
  }
}
