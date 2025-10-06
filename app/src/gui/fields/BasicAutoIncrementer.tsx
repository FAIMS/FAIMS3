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
 * Filename: BasicAutoIncrementer.tsx
 * Description:
 *   Implements an auto-incrementer field that is hidden but provides
 *   a value that can be used in templated string fields.
 */

import {FieldProps} from 'formik';
import {useEffect, useState} from 'react';
import {AutoIncrementer} from '../../local-data/autoincrement';
import {AutoIncrementEditForm} from '../components/autoincrement/edit-form';
import {Input} from '@mui/material';

interface Props {
  num_digits: number;
  // This could be dropped depending on how multi-stage forms are configured
  form_id: string;
  label?: string;
}

export const BasicAutoIncrementer = (props: FieldProps & Props) => {
  const [showAutoIncrementEditForm, setShowAutoIncrementEditForm] =
    useState(false);

  const incrementer = new AutoIncrementer(
    props.form.values['_project_id'],
    props.form_id,
    props.field.name
  );

  const compute_id = async (
    num_digits: number
  ): Promise<string | undefined> => {
    const new_id = await incrementer.nextValue();
    if (new_id === undefined) {
      return undefined;
    }
    return new_id.toString().padStart(num_digits, '0');
  };

  const update_form = async () => {
    const current_value = props.form.values[props.field.name];
    // we'll set the value in a form if the value has not already been set
    // assume it has been set if the value is not null, empty or undefined
    if (
      current_value === null ||
      current_value === '' ||
      current_value === undefined
    ) {
      const new_id = await compute_id(props.num_digits || 4);
      console.log('Computed new id', new_id);
      if (new_id === undefined) {
        setShowAutoIncrementEditForm(true);
      } else {
        props.form.setFieldValue(props.field.name, new_id, true);
      }
    }
    // reset any errors, we don't want to report these to the user
    if (props.form.errors[props.field.name] !== undefined)
      props.form.setFieldError(props.field.name, undefined);
  };

  useEffect(() => {
    update_form();
  }, [props.form.values[props.field.name]]);

  return (
    <>
      <Input
        name={props.field.name}
        id={props.field.name}
        readOnly={true}
        type={'hidden'}
      />
      <AutoIncrementEditForm
        project_id={props.form.values['_project_id']}
        form_id={props.form_id}
        field_id={props.field.name}
        label={props.field.name}
        open={showAutoIncrementEditForm}
        handleClose={async () => {
          await update_form();
          setShowAutoIncrementEditForm(false);
        }}
      />
    </>
  );
};

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'BasicAutoIncrementer',
//   'type-returned': 'faims-core::String', // matches a type in the Project Model
//   'component-parameters': {
//     name: 'basic-autoincrementer-field',
//     id: 'basic-autoincrementer-field',
//     variant: 'outlined',
//     required: true,
//     num_digits: 5,
//     form_id: 'default', // TODO: sort out this
//     label: 'Auto Increase Range',
//   },
//   validationSchema: [['yup.string'], ['yup.required']],
//   initialValue: null,
// };
