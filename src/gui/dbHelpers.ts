import * as Yup from 'yup';
// import {bool} from 'yup';

export function lookupFAIMSType(faimsType: string) {
  return {};
}

export function getUiSpecForProject(project_name: string) {
  // https://material-ui.com/components/text-fields/
  return {
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
          InputProps: {
            type: 'email',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Email Address',
          },
          FormHelperTextProps: {},
        },
        validationSchema: Yup.string()
          .email('Enter a valid email')
          .required('You must provide a valid email'),
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
          InputProps: {
            type: 'string',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'String Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: Yup.string()
          .min(2, 'Too Short!')
          .max(50, 'Too Long!')
          .required('You must provide a string'),
        initialValue: '',
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
          InputProps: {
            type: 'number',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Integer Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: Yup.number()
          .positive()
          .integer()
          .min(0, 'Min is 0')
          .max(20, 'max is 20')
          .required('Please provide an integer between 0 and 20'),
        initialValue: 1,
      },

      // 'str-field': {
      //   'component-namespace': 'core-material-ui',
      //   'component-name': 'TextField',
      //   'type-returned': 'faims-core::Integer', // matches a type in the Project Model
      //   'component-parameters': {
      //     fullWidth: true,
      //     name: project_name + 'str-field',
      //     id: project_name + 'str-field',
      //     helperText: 'Some helper text for string field',
      //     variant: 'outlined',
      //     InputProps: {
      //       type: 'string',
      //     },
      //     SelectProps: {},
      //     InputLabelProps: {
      //       label: 'String Field Label',
      //     },
      //     FormHelperTextProps: {},
      //   },
      // },
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
        //"next-view": "another-view-id", // either this gets handled by a component, or we stick it here
        //"next-view-label": "Done!"
      },
    },
    'start-view': 'start-view',
  };
}
