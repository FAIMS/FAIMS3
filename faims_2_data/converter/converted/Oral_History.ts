
import {setUiSpecForProject} from './uiSpecification';
import {ProjectUIModel} from './datamodel';

const example_ui_specs: {[key: string]: ProjectUIModel} = {
  'default/Oral History': {
    fields: {
      
'Interview_ID': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Interview_ID',
    id: 'Interview_ID',
    helperText: 'interviewid desc',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Interview_ID}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Interview_location': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Interview_location',
    id: 'Interview_location',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Interview_Location__address__city__state_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Latitude': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Latitude',
    id: 'Latitude',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Latitude}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Longitude': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Longitude',
    id: 'Longitude',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Longitude}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Northing': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Northing',
    id: 'Northing',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Northing}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Easting': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Easting',
    id: 'Easting',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Easting}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Accuracy': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Accuracy',
    id: 'Accuracy',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Accuracy}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Time_when_interview_started': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Time_when_interview_started',
    id: 'Time_when_interview_started',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Time_when_interview_started}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Time_when_interview_ended': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Time_when_interview_ended',
    id: 'Time_when_interview_ended',
    helperText: 'test',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Time_when_interview_ended}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Interview_ID': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Interview_ID',
    id: 'Interview_ID',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Interview_ID}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Interviewee_ID': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Interviewee_ID',
    id: 'Interviewee_ID',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Interviewee_ID}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'First_name_of_interviewee': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'First_name_of_interviewee',
    id: 'First_name_of_interviewee',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{First_name_of_interviewee}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Last_name_of_interviewee': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Last_name_of_interviewee',
    id: 'Last_name_of_interviewee',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Last_name_of_interviewee}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Gender':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Gender',
                  id: 'Gender',
                  helperText: '{Gender}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Male}',
  label: '{Male}',
}
,
{
  value: '{Female}',
  label: '{Female}',
}
,
{
  value: '{N_A}',
  label: '{N_A}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Gender}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Where_was_your_mother_born_village': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_was_your_mother_born_village',
    id: 'Where_was_your_mother_born_village',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_was_your_mother_born__village__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_was_your_father_born_village': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_was_your_father_born_village',
    id: 'Where_was_your_father_born_village',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_was_your_father_born__village__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'When_did_your_mother_migrate_to_Australia': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'When_did_your_mother_migrate_to_Australia',
    id: 'When_did_your_mother_migrate_to_Australia',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{When_did_your_mother_migrate_to_Australia_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'When_did_your_father_migrate_to_Australia': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'When_did_your_father_migrate_to_Australia',
    id: 'When_did_your_father_migrate_to_Australia',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{When_did_your_father_migrate_to_Australia_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_did_they_live_in_Australia_locality': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_did_they_live_in_Australia_locality',
    id: 'Where_did_they_live_in_Australia_locality',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_did_they_live_in_Australia__locality__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'What_was_your_fathers_occupation': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'What_was_your_fathers_occupation',
    id: 'What_was_your_fathers_occupation',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{What_was_your_father_s_occupation_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'If_so_what_was_your_mothers_occupation': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'If_so_what_was_your_mothers_occupation',
    id: 'If_so_what_was_your_mothers_occupation',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{If_so__what_was_your_mother_s_occupation_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'When_were_you_born': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'When_were_you_born',
    id: 'When_were_you_born',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{When_were_you_born_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_were_you_born_location': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_were_you_born_location',
    id: 'Where_were_you_born_location',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_were_you_born__city__town__locality__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_did_you_go_to_school_location': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_did_you_go_to_school_location',
    id: 'Where_did_you_go_to_school_location',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_did_you_go_to_school__city__town__locality__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_did_you_go_to_university': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Where_did_you_go_to_university',
    id: 'Where_did_you_go_to_university',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Where_did_you_go_to_university__institution__location__}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'What_was_your_first_line_of_work_occupation': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'What_was_your_first_line_of_work_occupation',
    id: 'What_was_your_first_line_of_work_occupation',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{What_was_your_first_line_of_work___occupation_}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Notes': {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'Notes',
    id: 'Notes',
    helperText: 'None',
    variant: 'outlined',
    required: true,
    InputProps: {
          type: 'string',
        },
    SelectProps: {},
    InputLabelProps: {
          label: '{Notes}',
        },
    FormHelperTextProps: {},
  },
  validationSchema: [
    ['yup.string']
  ],
  initialValue: '',
}
,
'Where_was_your_mother_born_region':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Where_was_your_mother_born_region',
                  id: 'Where_was_your_mother_born_region',
                  helperText: '{Where_was_your_mother_born__region__}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Thrace}',
  label: '{Thrace}',
}
,
{
  value: '{Macedonia}',
  label: '{Macedonia}',
}
,
{
  value: '{Thessaly}',
  label: '{Thessaly}',
}
,
{
  value: '{Epirus}',
  label: '{Epirus}',
}
,
{
  value: '{Central_Greece}',
  label: '{Central_Greece}',
}
,
{
  value: '{Peloponnese}',
  label: '{Peloponnese}',
}
,
{
  value: '{Aegean_Islands}',
  label: '{Aegean_Islands}',
}
,
{
  value: '{Ionian_Island}',
  label: '{Ionian_Island}',
}
,
{
  value: '{Crete}',
  label: '{Crete}',
}
,
{
  value: '{Outside_of_Greece}',
  label: '{Outside_of_Greece}',
}
,
{
  value: '{Non_Greek}',
  label: '{Non_Greek}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Where_was_your_mother_born__region__}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Where_was_your_father_born_region':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Where_was_your_father_born_region',
                  id: 'Where_was_your_father_born_region',
                  helperText: '{Where_was_your_father_born__region__}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Thrace}',
  label: '{Thrace}',
}
,
{
  value: '{Macedonia}',
  label: '{Macedonia}',
}
,
{
  value: '{Thessaly}',
  label: '{Thessaly}',
}
,
{
  value: '{Epirus}',
  label: '{Epirus}',
}
,
{
  value: '{Central_Greece}',
  label: '{Central_Greece}',
}
,
{
  value: '{Peloponnese}',
  label: '{Peloponnese}',
}
,
{
  value: '{Aegean_Islands}',
  label: '{Aegean_Islands}',
}
,
{
  value: '{Ionian_Island}',
  label: '{Ionian_Island}',
}
,
{
  value: '{Crete}',
  label: '{Crete}',
}
,
{
  value: '{Outside_of_Greece}',
  label: '{Outside_of_Greece}',
}
,
{
  value: '{Non_Greek}',
  label: '{Non_Greek}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Where_was_your_father_born__region__}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Did_your_mother_migrate_to_Australia':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Did_your_mother_migrate_to_Australia',
                  id: 'Did_your_mother_migrate_to_Australia',
                  helperText: '{Did_your_mother_migrate_to_Austraila_}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Yes}',
  label: '{Yes}',
}
,
{
  value: '{No}',
  label: '{No}',
}
,
{
  value: '{Other}',
  label: '{Other}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Did_your_mother_migrate_to_Austraila_}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Did_your_father_migrate_to_Australia':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Did_your_father_migrate_to_Australia',
                  id: 'Did_your_father_migrate_to_Australia',
                  helperText: '{Did_your_father_migrate_to_Austraila_}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Yes}',
  label: '{Yes}',
}
,
{
  value: '{No}',
  label: '{No}',
}
,
{
  value: '{Other}',
  label: '{Other}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Did_your_father_migrate_to_Austraila_}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Where_did_they_live_in_Australia_state':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Where_did_they_live_in_Australia_state',
                  id: 'Where_did_they_live_in_Australia_state',
                  helperText: '{Where_did_they_live_in_Australia__state__}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{ACT}',
  label: '{ACT}',
}
,
{
  value: '{NSW}',
  label: '{NSW}',
}
,
{
  value: '{NT}',
  label: '{NT}',
}
,
{
  value: '{QLD}',
  label: '{QLD}',
}
,
{
  value: '{SA}',
  label: '{SA}',
}
,
{
  value: '{TAS}',
  label: '{TAS}',
}
,
{
  value: '{VIC}',
  label: '{VIC}',
}
,
{
  value: '{WA}',
  label: '{WA}',
}
,
{
  value: '{Other}',
  label: '{Other}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Where_did_they_live_in_Australia__state__}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Did_your_mother_work':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Did_your_mother_work',
                  id: 'Did_your_mother_work',
                  helperText: '{Did_your_mother_work_}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Yes}',
  label: '{Yes}',
}
,
{
  value: '{No}',
  label: '{No}',
}
,
{
  value: '{N_A}',
  label: '{N_A}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Did_your_mother_work_}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Where_were_you_born_state':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Where_were_you_born_state',
                  id: 'Where_were_you_born_state',
                  helperText: '{Where_were_you_born__state__}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{ACT}',
  label: '{ACT}',
}
,
{
  value: '{NSW}',
  label: '{NSW}',
}
,
{
  value: '{NT}',
  label: '{NT}',
}
,
{
  value: '{QLD}',
  label: '{QLD}',
}
,
{
  value: '{SA}',
  label: '{SA}',
}
,
{
  value: '{TAS}',
  label: '{TAS}',
}
,
{
  value: '{VIC}',
  label: '{VIC}',
}
,
{
  value: '{WA}',
  label: '{WA}',
}
,
{
  value: '{Other}',
  label: '{Other}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Where_were_you_born__state__}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Where_did_you_go_to_school_state':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Where_did_you_go_to_school_state',
                  id: 'Where_did_you_go_to_school_state',
                  helperText: '{Where_did_you_go_to_school__state__}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{ACT}',
  label: '{ACT}',
}
,
{
  value: '{NSW}',
  label: '{NSW}',
}
,
{
  value: '{NT}',
  label: '{NT}',
}
,
{
  value: '{QLD}',
  label: '{QLD}',
}
,
{
  value: '{SA}',
  label: '{SA}',
}
,
{
  value: '{TAS}',
  label: '{TAS}',
}
,
{
  value: '{VIC}',
  label: '{VIC}',
}
,
{
  value: '{WA}',
  label: '{WA}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Where_did_you_go_to_school__state__}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }
,
'Do_you_recall_many_incidents_of_xenophobia_or_bigotry':{
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
                  fullWidth: true,
                  name: 'Do_you_recall_many_incidents_of_xenophobia_or_bigotry',
                  id: 'Do_you_recall_many_incidents_of_xenophobia_or_bigotry',
                  helperText: '{Do_you_recall_many_incidents_of_xenophobia_or_bigotry_}',
                  variant: 'outlined',
                  required: true,
                  select: true,
                  InputProps: {
                                      type: 'string',
                                    },
                  SelectProps: {
                                options: [
                                  
{
  value: '{Yes}',
  label: '{Yes}',
}
,
{
  value: '{No}',
  label: '{No}',
}
,
{
  value: '{N_A}',
  label: '{N_A}',
}

                                ],
                              },
                  InputLabelProps: {
                                      label: '{Do_you_recall_many_incidents_of_xenophobia_or_bigotry_}',
                                    },
                  FormHelperTextProps: {children: 'Some helper text'},
                },
        validationSchema: [['yup.string']],
        initialValue: '',
      }

    },
    views:{
      
'Interview/Admin':{
  fields:[
'Interview_ID',
'Interview_location',
'Latitude',
'Longitude',
'Northing',
'Easting',
'Accuracy',
'Time_when_interview_started',
'Time_when_interview_ended']
},
'next-view': 'FIXME',
'next-view-label': 'FIXME',
,
'Interview/Participants':{
  fields:[]
},
'next-view': 'FIXME',
'next-view-label': 'FIXME',
,
'Interview/External_Recordings':{
  fields:[]
},
'next-view': 'FIXME',
'next-view-label': 'FIXME',
,
'Participant/Participant_Admin':{
  fields:[
'Interview_ID',
'Interviewee_ID',
'First_name_of_interviewee',
'Last_name_of_interviewee',
'Gender']
},
'next-view': 'FIXME',
'next-view-label': 'FIXME',
,
'Participant/Participant_Questions':{
  fields:[
'Where_was_your_mother_born_village',
'Where_was_your_father_born_village',
'When_did_your_mother_migrate_to_Australia',
'When_did_your_father_migrate_to_Australia',
'Where_did_they_live_in_Australia_locality',
'What_was_your_fathers_occupation',
'If_so_what_was_your_mothers_occupation',
'When_were_you_born',
'Where_were_you_born_location',
'Where_did_you_go_to_school_location',
'Where_did_you_go_to_university',
'What_was_your_first_line_of_work_occupation',
'Notes',
'Where_was_your_mother_born_region',
'Where_was_your_father_born_region',
'Did_your_mother_migrate_to_Australia',
'Did_your_father_migrate_to_Australia',
'Where_did_they_live_in_Australia_state',
'Did_your_mother_work',
'Where_were_you_born_state',
'Where_did_you_go_to_school_state',
'Do_you_recall_many_incidents_of_xenophobia_or_bigotry']
},
'next-view': 'FIXME',
'next-view-label': 'FIXME',

    },
    start_view: first
  }
}

