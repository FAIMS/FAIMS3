import {ProjectObject} from '../datamodel';

export function lookupFAIMSType(faimsType: string) {
  return {};
}

export type ProjectsList = {
  [key: string]: ProjectObject;
};

export function getAvailableProjectsMetaData(username) : ProjectsList {
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
            helperText: 'Some helper text for email field',
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
          'component-namespace': 'core-material-ui', // this says what web component to use to render/acquire value from
          'component-name': 'TextField',
          'type-returned': 'faims-core::String', // matches a type in the Project Model
          'component-parameters': {
            fullWidth: true,
            name: 'str-field',
            id: 'str-field',
            helperText: 'Enter a string',
            variant: 'outlined',
            required: true,
            InputProps: {
              type: 'string',
            },
            SelectProps: {},
            InputLabelProps: {
              label: 'String Field Label',
            },
            FormHelperTextProps: {},
          },
          validationSchema: [
            ['yup.string'],
            ['yup.min', 2, 'Too Short!'],
            ['yup.max', 50, 'Too Long!'],
            ['yup.required'],
          ],
          initialValue: 'hello',
        },
        'int-field': {
          'component-namespace': 'core-material-ui', // this says what web component to use to render/acquire value from
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
        // 'bool-field': {
        //   'component-namespace': 'core-material-ui', // this says what web component to use to render/aquire value from
        //   'component-name': 'Checkbox',
        //   'type-returned': 'faims-core::Integer', // matches a type in the Project Model
        //   'component-parameters': {
        //     fullWidth: true,
        //     name: project_name + 'bool-field',
        //     id: project_name + 'bool-field',
        //     helperText: 'Some helper text for bool field',
        //     variant: 'outlined',
        //     InputProps: {
        //       type: 'checkbox',
        //     },
        //     SelectProps: {},
        //     InputLabelProps: {
        //       label: 'Bool Field Label',
        //     },
        //     FormHelperTextProps: {},
        //   },
        // },
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
            'int-field',
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
