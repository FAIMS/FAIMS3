import {setUiSpecForProject} from './uiSpecification';
import {ProjectUIModel} from './datamodel';

const example_ui_specs: {[key: string]: ProjectUIModel} = {
  'default/projectA': {
    fields: {
      'bad-field': {
        'component-namespace': 'fakefakefake', // this says what web component to use to render/acquire value from
        'component-name': 'NotAComponent',
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
      'action-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'ActionButton',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'action-field',
          id: 'action-field',
          helperText: 'Enter a string between 2 and 50 characters long',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'string',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'String Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [['yup.string']],
        initialValue: 'hello',
      },
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
          helperText: 'Choose a currency',
          variant: 'outlined',
          required: true,
          select: true,
          InputProps: {
            type: 'string',
          },
          SelectProps: {
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
            label: 'Choose a currency',
          },
          FormHelperTextProps: {children: 'Some helper text'},
        },
        validationSchema: [['yup.string'], ['yup.required']],
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
          helperText: 'Choose multiple currencies',
          variant: 'outlined',
          required: true,
          select: true,
          InputProps: {
            type: 'string',
          },
          SelectProps: {
            multiple: true,
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
            label: 'Choose multiple currencies',
          },
          FormHelperTextProps: {children: 'Some helper text'},
        },
        validationSchema: [['yup.string'], ['yup.required']],
        initialValue: [],
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
          'bad-field',
          'action-field',
          'email-field',
          'str-field',
          'int-field',
          'select-field',
          'multi-select-field',
          // 'bool-field',
          // 'date-field',
          // 'time-field',
        ], // ordering sets appearance order
      },
      'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
      'next-view-label': 'Done!',
    },

    start_view: 'start-view',
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
    start_view: 'start-view',
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
    start_view: 'start-view',
  },
};

export async function setupExampleForms() {
  let result;
  for (const projname in example_ui_specs) {
    result = await setUiSpecForProject(projname, example_ui_specs[projname]);
    console.log(result);
  }
  console.log(result);
  result = await setUiSpecForProject(
    'csiro/csiro-geochemistry',
    example_ui_specs['default/projectB']
  );
  console.log(result);
}
