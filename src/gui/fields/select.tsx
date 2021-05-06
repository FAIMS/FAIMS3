import React from 'react';
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import {MenuItem} from '@material-ui/core';

interface option {
  key: string;
  value: string;
  label: string;
}

interface ElementProps {
  options: Array<option>;
}

interface Props {
  ElementProps: ElementProps;
}

export class Select extends React.Component<TextFieldProps & Props> {
  render() {
    const {ElementProps, children, ...textFieldProps} = this.props;
    console.log(ElementProps, children, textFieldProps);
    return (
      <MuiTextField {...fieldToTextField(textFieldProps)} select={true}>
        {children}
        {ElementProps.options.map(option => (
          <MenuItem
            key={option.key ? option.key : option.value}
            value={option.value}
          >
            {option.label}
          </MenuItem>
        ))}
      </MuiTextField>
    );
  }
}
