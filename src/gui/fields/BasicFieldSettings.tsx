import {getComponentFromField} from '../components/project/FormElement';
import {
  ProjectUIModel,
  componenentSettingprops,
  FAIMSEVENTTYPE,
} from '../../datamodel/ui';
import {ProjectUIFields} from '../../datamodel/typesystem';
/* eslint-disable @typescript-eslint/no-unused-vars */

const getdvalue = (value: any) => {
  return JSON.parse(JSON.stringify(value));
};

export const getDefaultuiSetting = () => {
  return getdvalue(DefaultuiSetting);
};

export const getDefaultuiSpec = () => {
  return getdvalue(DefaultuiSpec);
};

const DefaultuiSpec = {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'TextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'Helper Text',
    variant: 'outlined',
    required: false,
    InputProps: {
      type: 'text', // must be a valid html type
    },
    SelectProps: {},
    InputLabelProps: {
      label: 'Text Field',
    },
    FormHelperTextProps: {},
  },
  validationSchema: [['yup.string']],
  initialValue: '',
};

const DefaultuiSetting: ProjectUIModel = {
  fields: {
    options: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      access: ['admin'],
      'component-parameters': {
        name: 'textInput',
        id: 'textInput',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: "Add options here, use ','to seperate option",
        InputLabelProps: {
          label: 'Options',
        },
        type: 'text',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: 'options',
    },
    label: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      access: ['admin'],
      'component-parameters': {
        name: 'textInput',
        id: 'textInput',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Label',
        },
        type: 'text',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: 'label',
    },
    helperText: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      access: ['admin'],
      'component-parameters': {
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Helper Text',
        },
        type: 'text',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: 'helperText',
    },
  },
  views: {
    InputProps: {
      fields: ['label'],
      uidesign: 'form',
      label: 'InputProps',
    },
    InputLabelProps: {
      fields: ['label'],
      uidesign: 'form',
      label: 'InputProps',
    },
    ElementProps: {
      fields: ['options'],
      uidesign: 'form',
      label: 'ElementProps',
    },
    FormLabelProps: {
      fields: ['label'],
      uidesign: 'form',
      label: 'InputProps',
    },
    FormHelperTextProps: {
      fields: ['helperText'],
      uidesign: 'form',
      label: 'FormHelperTextProps',
    },
    FormControlLabelProps: {
      fields: ['label'],
      uidesign: 'form',
      label: 'FormControlLabelProps',
    },
    FormParamater: {
      fields: ['helperText'],
      uidesign: 'form',
      label: 'FormParamater',
    },
  },
  viewsets: {
    settings: {
      views: ['InputLabelProps', 'FormParamater'],
      label: 'settings',
    },
  },
  visible_types: ['settings'],
};

export const TextuiSpec = getDefaultuiSpec();
export const TextuiSetting = getDefaultuiSetting();

export const MultiTextuiSpec = {
  'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
  'component-name': 'MultipleTextField',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    helperText: 'Helper Text',
    variant: 'outlined',
    required: false,
    multiline: true,
    InputProps: {
      type: 'text',
      rows: 4,
    },
    SelectProps: {},
    InputLabelProps: {
      label: 'Text Field',
    },
    FormHelperTextProps: {},
  },
  validationSchema: [['yup.string']],
  initialValue: '',
};

export const MultiTextuiSetting = {
  fields: {
    ...DefaultuiSetting.fields,
    rows: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::Integer',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'textInput',
        id: 'textInput',
        variant: 'outlined',
        required: false,
        fullWidth: true,
        helperText: 'Please put number as row number',
        InputLabelProps: {
          label: 'Number of Line',
        },
        type: 'number',
      },
      alert: false,
      validationSchema: [['yup.number'], ['yup.positive']],
      initialValue: 'rows',
    },
  },
  views: {
    ...DefaultuiSetting.views,
    InputProps: {
      fields: ['rows'],
      uidesign: 'form',
      label: 'InputProps',
    },
  },
  viewsets: {
    settings: {
      views: ['InputLabelProps', 'FormParamater'],
      label: 'settings',
    },
  },
  visible_types: ['settings'],
};

const getfieldNamesbyView = (
  uiSetting: ProjectUIModel,
  view: string,
  fieldui: ProjectUIFields
) => {
  if (view === 'meta') return uiSetting['views'][view]['fields'] ?? [];
  if (view === 'validationSchema')
    return uiSetting['views'][view]['fields'] ?? [];
  if (view === 'access') return uiSetting['views'][view]['fields'] ?? [];
  if (view === 'FormParamater') return uiSetting['views'][view]['fields'] ?? [];
  if (view === 'other') return uiSetting['views'][view]['fields'] ?? [];
  if (
    uiSetting['views'][view] !== undefined &&
    fieldui['component-parameters'][view] !== undefined
  )
    return uiSetting['views'][view]['fields'];
  return [];
};

export function Defaultcomponentsetting(props: componenentSettingprops) {
  const uiSetting = props.uiSetting;
  const handlerchanges = (event: FAIMSEVENTTYPE) => {
    if (props.handlerchanges !== undefined) {
      props.handlerchanges(event);
    }
  };

  const handlerchangewithview = (event: FAIMSEVENTTYPE, view: string) => {
    props.handlerchangewithview(event, view);
    handlerchanges(event);
  };

  return (
    <>
      {uiSetting['viewsets'][props.designvalue]['views'] !== undefined &&
      uiSetting['viewsets'][props.designvalue]['views'].length === 0
        ? ''
        : uiSetting['viewsets'][props.designvalue]['views'].map((view: any) =>
            getfieldNamesbyView(uiSetting, view, props.fieldui).map(
              (fieldName: string) =>
                getComponentFromField(
                  uiSetting,
                  fieldName,
                  props.formProps,
                  (event: FAIMSEVENTTYPE) => {
                    handlerchangewithview(event, view);
                  }
                )
            )
          )}
    </>
  );
}
