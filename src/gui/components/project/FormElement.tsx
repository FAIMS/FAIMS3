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
 * Filename: FormElement.tsx
 * Description: This is the file for formelemnets for Notebook Creation, not contain any information about handler(check other files)
 *   TODO: any type
 *   TODO: different design settings
 */

import React from 'react';

import {useState, useEffect} from 'react';
import {Formik, Form, Field, FormikProps, FormikValues} from 'formik';
import {
  Button,
  Grid,
  Box,
  ButtonGroup,
  Typography,
  Chip,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import {getComponentByName} from '../../component_registry';
import {setProjectInitialValues} from './data/ComponentSetting';
import {TickButton} from './tabs/ProjectButton';
import Autocomplete from '@material-ui/lab/Autocomplete';
import {TextField} from '@material-ui/core';

type FormElement = {
  uiSpec: any;
  handleChangeForm: any;
  currentView: string;
  handleSubmit?: any;
};

export const getComponentFromField = (
  uiSpec: any,
  fieldName: string,
  formProps: any,
  handleChangeC: any,
  uidesign = 'alert'
) => {
  // console.log('getComponentFromField');

  const fields = uiSpec['fields'];
  const fieldConfig = fields[fieldName];
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  let Component: React.Component;
  try {
    Component = getComponentByName(namespace, name);
  } catch (err) {
    return <>Error</>;
  }
  const value = formProps.values[fieldName];

  return (
    <Box key={fieldName}>
      <Field
        component={Component}
        name={fieldName}
        onChange={(e: React.FocusEvent<{name: string}>) => {
          formProps.handleChange(e);
          handleChangeC(e);
        }}
        onBlur={(e: React.FocusEvent<{name: string}>) => {
          formProps.handleChange(e);
          handleChangeC(e);
        }}
        value={value}
        {...fieldConfig['component-parameters']}
        {...fieldConfig['component-parameters']['InputProps']}
        {...fieldConfig['component-parameters']['SelectProps']}
        {...fieldConfig['component-parameters']['InputLabelProps']}
        {...fieldConfig['component-parameters']['FormHelperTextProps']}
      />
    </Box>
  );
};

export function FormForm(props: FormElement) {
  const {currentView, handleChangeForm, ...others} = props;
  const [uiSpec, setUISpec] = useState(props.uiSpec);
  const initialValues = setProjectInitialValues(uiSpec, currentView, {});
  console.log(initialValues)
  const getfields = (uiSpec:any,formProps:any,handleChangeForm:any,currentView:string) =>{
    return (<Grid>
      {uiSpec['views'][currentView][
        'fields'
      ].map((field: any, index: any) =>
        getComponentFromField(
          uiSpec,
          field,
          formProps,
          handleChangeForm
        )
      )}</Grid>)
  }
  return (
    <Formik
      initialValues={initialValues}
      validateOnMount={true}
      onSubmit={(values, {setSubmitting}) => {
        setTimeout(() => {
          setSubmitting(false);
          props.handleSubmit(values);
        }, 500);
      }}
    >
      {formProps => {
        return (
          <Form id="form">
            {uiSpec['views'][currentView]['uidesign'] !== 'tab' ? (
              getfields(uiSpec,formProps,handleChangeForm,currentView)
            ) : (
              <Grid container>
                <Grid item sm={11} xs={12}>
                  <Grid container>
                    {uiSpec['views'][currentView]['fields'].map(
                      (field: any, index: any) => (
                        <Grid item sm={2} xs={12} key={field}>
                          {getComponentFromField(
                            uiSpec,
                            field,
                            formProps,
                            handleChangeForm
                          )}
                        </Grid>
                      )
                    )}
                  </Grid>
                </Grid>
                <Grid item sm={1} xs={12}>
                  <TickButton id="submit" type="submit" />
                </Grid>
              </Grid>
            )}
          </Form>
        );
      }}
    </Formik>
  );
}

export function AutocompleteForm(props: any) {
  const {options, handleAutocomplete, ...others} = props;
  const id = 'access' + props.id;
  // const [options,setoptions] =useState(props.options)
  const [value, setValue] = React.useState(
    options.length > 0 ? options[0] : null
  );
  const [inputValue, setInputValue] = React.useState('');
  const [labels, setlabels] = useState<Array<string>>(props.labels ?? []);
  useEffect(() => {
    if (props.labels !== undefined) setlabels(props.labels);
  }, [props.labels]);
  const handleDelete = (index: string) => {
    const newlabels = labels.filter((label: string) => label !== index);
    setlabels(newlabels);

    props.handleAutocomplete(newlabels, props.id, props.type);
  };
  return (
    <Grid container={true}>
      <Grid>
        <Autocomplete
          id={id}
          value={value}
          onChange={(event, newValue) => {
            if (newValue !== null) {
              setValue(newValue);
              if (labels.includes(newValue.value) === false) {
                const newlabels = [...labels, newValue.value];
                setlabels(newlabels);

                props.handleAutocomplete(newlabels, props.id, props.type);
              }

                  }

                }}
          size={'small'}
          inputValue={inputValue}
          onInputChange={(event, newInputValue) => {
            setInputValue(newInputValue);
          }}
          options={options}
          getOptionLabel={option => option.label}
          style={{width: 300}}
          openOnFocus={true}
          renderInput={params => (
            <TextField {...params} label="Access" variant="outlined" />
          )}
        />
        {labels.map((label: string) =>
          label !== 'admin' ? (
            <Chip label={label} onDelete={() => handleDelete(label)} />
          ) : (
            <Chip label={label} />
          )
        )}
      </Grid>
      </Grid>
  );
}
