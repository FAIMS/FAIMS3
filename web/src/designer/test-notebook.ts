//import { Notebook } from "./state/initial";

import {Notebook} from './state/initial';

export const sampleNotebook: Notebook = {
  metadata: {
    notebook_version: '1.0',
    schema_version: '1.0',
    name: 'RSpace IGSN Demo',
    accesses: ['admin', 'moderator', 'team'],
    filenames: [],
    ispublic: false,
    isrequest: false,
    lead_institution: 'Fieldmark',
    showQRCodeButton: 'true',
    pre_description:
      'Demonstration notebook to help develop an export pipeline from Fieldmark to RSpace.',
    project_lead: 'Steve Cassidy',
    project_status: 'New',
    sections: {
      'Primary-New-Section': {
        'sectiondescriptionPrimary-New-Section': 'This description.',
      },
      'Primary-Next-Section': {
        'sectiondescriptionPrimary-Next-Section': 'That description.',
      },
    },
  },
  'ui-specification': {
    fields: {
      'New-Text-Field': {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Summarise the collection location.',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'text',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Location Description',
          },
          FormHelperTextProps: {},
          name: 'New-Text-Field',
        },
        initialValue: '',
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },
      'Field-ID': {
        'component-namespace': 'faims-custom',
        'component-name': 'BasicAutoIncrementer',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          name: 'Field-ID',
          id: 'basic-autoincrementer-field',
          variant: 'outlined',
          required: true,
          num_digits: 5,
          form_id: 'Primary-Next-Section',
          label: 'ID',
        },
        initialValue: null,
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },
      'hridPrimary-Next-Section': {
        'component-namespace': 'faims-custom',
        'component-name': 'TemplatedStringField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          name: 'hridPrimary-Next-Section',
          id: 'hrid-field',
          helperText: 'Human Readable observation ID',
          variant: 'outlined',
          required: true,
          template: '',
          InputProps: {
            type: 'text',
          },
          InputLabelProps: {
            label: 'Identifier',
          },
        },
        initialValue: '',
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },
      'IGSN-QR-Code': {
        'component-namespace': 'qrcode',
        'component-name': 'QRCodeFormField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          name: 'IGSN-QR-Code',
          id: 'qr-code-field',
          variant: 'outlined',
          required: true,
          FormLabelProps: {
            children: 'IGSN QR Code',
          },
          FormHelperTextProps: {
            children: 'Scan the pre-printed QR Code for this sample.',
          },
        },
        initialValue: '1',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
      },
      'Sample-Location': {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePoint',
        'type-returned': 'faims-pos::Location',
        'component-parameters': {
          fullWidth: true,
          name: 'Sample-Location',
          id: 'take-point-field',
          helperText: 'Click to save current location',
          variant: 'outlined',
          label: 'Sample Location',
        },
        initialValue: null,
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },
      'Sample-Photograph': {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePhoto',
        'type-returned': 'faims-attachment::Files',
        'component-parameters': {
          fullWidth: true,
          name: 'Sample-Photograph',
          id: 'take-photo-field',
          helpertext: 'Take a photo',
          variant: 'outlined',
          label: 'Sample Photograph',
        },
        initialValue: null,
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },
      'Length-mm': {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::Integer',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Longest dimension of sample in mm.',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'number',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Length (mm)',
          },
          FormHelperTextProps: {},
          name: 'Length-mm',
        },
        initialValue: '',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: true,
            label: 'uncertainty',
          },
        },
      },

      'survey-note': {
        'component-namespace': 'formik-material-ui',
        'component-name': 'MultipleTextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Note comments about survey area here',
          variant: 'outlined',
          required: false,
          multiline: true,
          InputProps: {
            type: 'text',
            rows: 4,
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Survey Note',
          },
          FormHelperTextProps: {},
          id: 'survey-note',
          name: 'survey-note',
        },
        initialValue: '',
        access: ['admin'],
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
      },
      Type: {
        'component-namespace': 'faims-custom',
        'component-name': 'Select',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Choose a field from the dropdown',
          variant: 'outlined',
          required: false,
          select: true,
          InputProps: {},
          SelectProps: {},
          ElementProps: {
            options: [
              {
                label: 'Igneous',
                value: 'Igneous',
              },
              {
                label: 'Metamorphic',
                value: 'Metamorphic',
              },
              {
                label: 'Sedementary',
                value: 'Sedementary',
              },
            ],
          },
          InputLabelProps: {
            label: 'Type',
          },
          name: 'Type',
        },
        initialValue: '',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
      },
      safety_hazard: {
        'component-namespace': 'faims-custom',
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool',
        'component-parameters': {
          name: 'safety_hazard',
          id: 'safety_hazard',
          required: false,
          type: 'checkbox',
          FormControlLabelProps: {
            label: 'Safety Hazard',
          },
          FormHelperTextProps: {
            children: 'Selecting this box will alert maintenance (eventually)',
          },
        },
        initialValue: false,
        access: ['admin'],
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
      },
    },
    fviews: {
      'Primary-New-Section': {
        label: 'Detail',
        fields: [
          'Sample-Location',
          'New-Text-Field',
          'Sample-Photograph',
          'Length-mm',
          'Type',
          'safety_hazard',
        ],
      },
      'Primary-Next-Section': {
        label: 'Identify',
        fields: [
          'Field-ID',
          'hridPrimary-Next-Section',
          'IGSN-QR-Code',
          'survey-note',
        ],
      },
    },
    viewsets: {
      Primary: {
        label: 'Observation',
        views: ['Primary-Next-Section', 'Primary-New-Section'],
        publishButtonBehaviour: 'always',
      },
    },
    visible_types: ['Primary'],
  },
};
