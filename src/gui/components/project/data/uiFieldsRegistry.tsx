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
 * Filename: uiFieldsRegistry.tsx
 * Description:
 *   TODO: ADD function to pass and update validationschema
 *   TODO: ADD function to pass and update access
 *   TODO: function getfields Field icon not working
 *   TODO: initial value for options, validationschema
 */

import {
  getComponentByName,
  getComponentPropertiesByName,
  getAvailableComponents,
} from '../../../component_registry';
import {FormComponent} from '../../../../datamodel/ui';

export const getfields = () => {
  const fields: any = {};
  let fieldtabs: Array<string> = [];
  getAvailableComponents().map((component: FormComponent) => {
    const category = component.component_properties.category;
    const props = component.component_properties;
    if (
      props.human_readable_name !== '' &&
      ['Text', 'Select', 'Special'].includes(props.category)
    ) {
      //TODO: required to update in the future
      if (!fieldtabs.includes(category)) {
        fields[category] = [{...props}];
        fieldtabs = [...fieldtabs, category];
      } else fields[category] = [...fields[category], {...props}];
    }
  });
  return {fields, fieldtabs};
};

const accessgroup = ['admin'];

export const getcomponent = (props: any) => {
  if (props.componentName === undefined) {
    const newprops = getComponentPropertiesByName(
      'formik-material-ui',
      'TextField'
    );
    return TextField({...props, ...newprops['uiSpecProps']});
  }
  if (props.componentName === 'Checkbox') return Checkbox(props);
  if (props.componentName === 'TakePoint') return SpecialField(props);
  if (
    props.componentName === 'TextField' ||
    props.componentName === 'Select' ||
    props.componentName === 'MultipleTextField'
  )
    return TextField(props);
  return SpecialField(props);
};

const FieldModel = (props: any) => {
  const {
    name,
    namespace,
    componentName,
    type_return,
    required,
    initialValue,
    validationSchema,
    multiline,
    multirows,
    select,
    options,
    multselect,
    annotation_label,
    meta_type,
    meta_type_label,
    access,
    ...others
  } = props;
  let isrequired = false;
  if (required === true) isrequired = required;
  const uiSpec = {
    'component-namespace': namespace, // this says what web component to use to render/acquire value from
    'component-name': componentName,
    'type-returned': type_return, // matches a type in the Project Model
    meta: {
      annotation_label: annotation_label ?? 'annotation',
      uncertainty: {
        include: meta_type ?? false,
        label: meta_type_label ?? 'uncertainty',
      },
    },
    access: access ?? accessgroup,
    'component-parameters': {
      name: name,
      id: name,
      variant: 'outlined',
      required: isrequired,
      ...others,
    },
    alert: false,
    validationSchema: validationSchema ?? [],
    initialValue: initialValue ?? '',
  };
  if (select === true) {
    uiSpec['component-parameters']['select'] = true;
    uiSpec['component-parameters']['ElementProps'] = {
      options: options ?? [
        {
          value: 'Default',
          label: 'Default',
        },
      ],
    };
    uiSpec['component-parameters']['SelectProps'] = {
      multiple: props.multselect ?? false,
    };
    if (props.multselect === true) uiSpec.initialValue = initialValue ?? [''];
  }
  if (multiline === true) uiSpec['component-parameters']['multiline'] = true;
  if (componentName === 'TakePoint') {
    if (initialValue !== '' && initialValue !== undefined)
      uiSpec.initialValue = initialValue;
    else uiSpec.initialValue = null;
  }
  return uiSpec;
};

const TextField = (props: any) => {
  const {
    label,
    helperText,
    validationSchema,
    initialValue,
    multiline,
    ...others
  } = props;
  return FieldModel({
    type_return: props.type_return ?? 'faims-core::String',
    InputProps: {
      type: props.type ?? 'text',
      rows: props.multirows ?? 1,
    },
    fullWidth: true,
    multiline: multiline ?? false,
    validationSchema: validationSchema ?? [['yup.string']],
    helperText: helperText ?? '',
    InputLabelProps: {
      label: label,
    },
    initialValue: initialValue,
    ...others,
  });
};

const SpecialField = (props: any) => {
  const {label, helperText, validationSchema, initialValue, ...others} = props;
  return FieldModel({
    namespace: props.namespace,
    type_return: props.type_return,
    componentName: props.componentName,
    fullWidth: true,
    validationSchema: validationSchema ?? props.validationSchema,
    helperText: helperText ?? '',
    initialValue: initialValue,
    ...others,
  });
};

const Checkbox = (props: any) => {
  const {label, helperText, validationSchema, initialValue, ...others} = props;
  return FieldModel({
    namespace: 'faims-custom',
    type_return: 'faims-core::Bool',
    componentName: 'Checkbox',
    type: 'checkbox',
    validationSchema: [validationSchema ?? ['yup.bool']],
    FormControlLabelProps: {
      label: label,
    },
    initialValue: initialValue ?? false,
    FormHelperTextProps: {children: helperText ?? ''},
    ...others,
  });
};
