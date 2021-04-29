import {ProjectObject} from '../datamodel';

export function lookupFAIMSType(faimsType: string) {
  return {};
}

export type ProjectsList = {
  [key: string]: ProjectObject;
};

export function getAvailableProjectsMetaData(username): ProjectsList {
  return {
    'default/projectA': {
      _id: 'projectA',
      name: 'Project A',
      description: 'A dummy project',
    },
    'default/projectB': {
      _id: 'projectB',
      name: 'Project B',
      description: 'A dummy project',
    },
    'default/projectC': {
      _id: 'projectC',
      name: 'Project C',
      description: 'A dummy project',
    },
  };
}

export function getUiSpecForProject(active_id: string) {
  // https://material-ui.com/components/text-fields/
  const project_spec = {
    'default/projectA': {
      fields: {
        'email-field': {
          'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
          'component-name': 'TextField',
          'type-returned': 'faims-core::Email', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'email-field',
            id: 'email-field',
            helperText: 'Please provide a valid email address',
            variant: 'outlined',
            required: true,
            InputProps: {
              type: 'email',
            },
            SelectProps: {},
            InputLabelProps: {
              label: 'Email Address',
            },
            FormHelperTextProps: {},
          },
          validationSchema: [
            ['yup.string'],
            ['yup.email', 'Enter a valid email'],
            ['yup.required'],
          ],
          initialValue: '',
        },
        'str-field': {
          'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
          'component-name': 'TextField',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'str-field',
            id: 'str-field',
            helperText: 'Enter a string between 2 and 50 characters long',
            variant: 'outlined',
            required: true,
            InputProps: {
              type: 'text', // must be a valid html type
            },
            SelectProps: {},
            InputLabelProps: {
              label: 'Favourite Colour',
            },
            FormHelperTextProps: {},
          },
          validationSchema: [
            ['yup.string'],
            ['yup.min', 2, 'Too Short!'],
            ['yup.max', 50, 'Too Long!'],
            ['yup.required'],
          ],
          initialValue: 'yellow',
        },
        'multi-str-field': {
          'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
          'component-name': 'TextField',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'multi-str-field',
            id: 'multi-str-field',
            helperText: 'Textarea help',
            variant: 'outlined',
            required: true,
            multiline: true,
            InputProps: {
              type: 'text',
              rows: 4,
            },
            SelectProps: {},
            InputLabelProps: {
              label: 'Textarea Field Label',
            },
            FormHelperTextProps: {},
          },
          validationSchema: [['yup.string'], ['yup.required']],
          initialValue:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        },
        'int-field': {
          'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
          'component-name': 'TextField',
          'type-returned': 'faims-core::Integer', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'int-field',
            id: 'int-field',
            helperText: 'Enter an integer between 0 and 20',
            variant: 'outlined',
            required: true,
            InputProps: {
              type: 'number',
            },
            SelectProps: {},
            InputLabelProps: {
              label: 'Integer Field Label',
            },
            FormHelperTextProps: {},
          },
          validationSchema: [
            ['yup.number'],
            ['yup.positive'],
            ['yup.integer'],
            ['yup.min', 0, 'Min is 0'],
            ['yup.max', 20, 'Max is 20'],
          ],
          initialValue: 1,
        },
        'select-field': {
          'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
          'component-name': 'Select',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'select-field',
            id: 'select-field',
            helperText: 'Choose a currency from the dropdown',
            variant: 'outlined',
            required: true,
            select: true,
            InputProps: {},
            SelectProps: {
            },
            ElementProps: {
              options: [
                {
                  value: 'USD',
                  label: '$',
                },
                {
                  value: 'EUR',
                  label: '€',
                },
                {
                  value: 'BTC',
                  label: '฿',
                },
                {
                  value: 'JPY',
                  label: '¥',
                },
              ],
            },
            InputLabelProps: {
              label: 'Currency',
            },
          },
          validationSchema: [
            ['yup.string'],
            ['yup.required', 'Currency is a required field'],
          ],
          initialValue: '',
        },
        'multi-select-field': {
          'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
          'component-name': 'Select',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'multi-select-field',
            id: 'multi-select-field',
            helperText: 'Choose multiple currencies from the dropdown',
            variant: 'outlined',
            required: true,
            select: true,
            InputProps: {},
            SelectProps: {
              multiple: true,
            },
            InputLabelProps: {
              label: 'Currencies',
            },
            FormHelperTextProps: {children: 'Some helper text'},
            ElementProps: {
              options: [
                {
                  value: 'USD',
                  label: '$',
                },
                {
                  value: 'EUR',
                  label: '€',
                },
                {
                  value: 'BTC',
                  label: '฿',
                },
                {
                  value: 'JPY',
                  label: '¥',
                },
              ],
            },
          },
          validationSchema: [
            ['yup.string'],
            ['yup.required', 'Currencies is a required field'],
          ],
          initialValue: [],
        },
        'checkbox-field': {
          'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
          'component-name': 'Checkbox',
          'type-returned': 'faims-core::Bool', // matches a type in the Project Model
          'component-parameters': {
            name: 'checkbox-field',
            id: 'checkbox-field',
            required: true,
            type: 'checkbox',
            FormControlLabelProps: {
              label: 'Terms and Conditions',
            },
            FormHelperTextProps: {
              children: 'Read the terms and conditions carefully.',
            },
            // Label: {label: 'Terms and Conditions'},
          },
          validationSchema: [
            ['yup.bool'],
            ['yup.oneOf', [true], 'You must accept the terms and conditions'],
            ['yup.required'],
          ],
          initialValue: false,
        },
        'radio-group-field': {
          'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
          'component-name': 'RadioGroup',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            name: 'radio-group-field',
            id: 'radio-group-field',
            variant: 'outlined',
            required: true,
            ElementProps: {
              options: [
                {
                  value: '1',
                  label: '1',
                },
                {
                  value: '2',
                  label: '2',
                },
                {
                  value: '3',
                  label: '3',
                },
                {
                  value: '4',
                  label: '4',
                },
              ],
            },
            FormLabelProps: {
              children: 'Pick a number',
            },
            FormHelperTextProps: {
              children: 'Make sure you choose the right one!',
            },
          },
          // validationSchema: [['yup.number'], ['yup.lessThan', 2]],
          initialValue: '3',
        },
        // 'date-field': {
        //   'component-namespace': 'core-material-ui', // this says what web component to use to render/aquire value from
        //   'component-name': 'TextField',
        //   'type-returned': 'faims-core::Integer', // matches a type in the Project Model
        //   'component-parameters': {
        //     type: 'date',
        //     fullWidth: true,
        //     label: 'A date field',
        //     helperText: 'some help text',
        //     defaultValue: '2017-05-24T10:30',
        //   }, // configure appearance/actions/etc. of component
        // },
        // 'time-field': {
        //   'component-namespace': 'core-material-ui', // this says what web component to use to render/aquire value from
        //   'component-name': 'TextField',
        //   'type-returned': 'faims-core::Integer', // matches a type in the Project Model
        //
        //   'component-parameters': {
        //     type: 'time',
        //     label: 'A time field',
        //     helperText: 'some help text',
        //     documentation: '<p>Some HTML</p>', // the documentation on the field
        //   }, // configure appearance/actions/etc. of component
        // },
      },
      views: {
        'start-view': {
          fields: [
            'email-field',
            'str-field',
            'multi-str-field',
            'int-field',
            'select-field',
            'multi-select-field',
            'checkbox-field',
            'radio-group-field',
            // 'bool-field',
            // 'date-field',
            // 'time-field',
          ], // ordering sets appearance order
        },
        'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
        'next-view-label': 'Done!',
      },

      'start-view': 'start-view',
    },
    'default/projectB': {
      fields: {},
      views: {
        'start-view': {
          fields: [
            // 'email-field',
            // 'str-field',
            // 'int-field',
            // 'bool-field',
            // 'date-field',
            // 'time-field',
          ], // ordering sets appearance order
        },
        'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
        'next-view-label': 'Done!',
      },
      'start-view': 'start-view',
    },
    'default/projectC': {
      fields: {},
      views: {
        'start-view': {
          fields: [
            // 'email-field',
            // 'str-field',
            // 'int-field',
            // 'bool-field',
            // 'date-field',
            // 'time-field',
          ], // ordering sets appearance order
        },
        'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
        'next-view-label': 'Done!',
      },
      'start-view': 'start-view',
    },
  };
  // For sync merge with ui-form debugging
  project_spec['default/lake_mungo'] = project_spec['default/projectA'];
  project_spec['csiro/csiro-geochemistry'] = project_spec['default/projectB'];
  return project_spec[active_id];
}
