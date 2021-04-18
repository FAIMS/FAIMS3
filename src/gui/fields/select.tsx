import React from 'react';
import MuiTextField from '@material-ui/core/TextField';
import {fieldToTextField, TextFieldProps} from 'formik-material-ui';
import {MenuItem} from '@material-ui/core';

interface Props {
  options: Array<object>;
}

export class Select extends React.Component<TextFieldProps & Props> {
  render() {
    const {options, children, ...textFieldProps} = this.props;

    return (
      <MuiTextField {...fieldToTextField(textFieldProps)}>
        {children}
        {options.map(option => (
          <MenuItem
            key={option['key'] ? option['key'] : option['value']}
            value={option['value']}
          >
            {option['label']}
          </MenuItem>
        ))}
      </MuiTextField>
    );
  }
}
