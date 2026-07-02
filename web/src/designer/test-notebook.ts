/**
 * @file Large in-repo {@link Notebook} fixture for tests and local designer development.
 */

import type {Notebook} from './state/initial';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from './state/initial';

/** Current-schema notebook (RSpace IGSN demo design). */
export const sampleNotebook: Notebook = {
  uiSpec: {
    fields: {
      'New-Text-Field': {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Location Description',
          name: 'New-Text-Field',
          helperText: 'Summarise the collection location.',
          required: false,
        },
        initialValue: '',
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {include: true, label: 'uncertainty'},
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
        initialValue: '',
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {include: true, label: 'uncertainty'},
        },
      },
      Identifier: {
        'component-namespace': 'faims-custom',
        'component-name': 'TemplatedStringField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          name: 'Identifier',
          id: 'identifier-field',
          helperText: 'Human Readable observation ID',
          variant: 'outlined',
          required: true,
          template: '',
          InputProps: {type: 'text'},
          label: 'Identifier',
        },
        initialValue: '',
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {include: true, label: 'uncertainty'},
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
          label: 'IGSN QR Code',
          helperText: 'Scan the pre-printed QR Code for this sample.',
        },
        initialValue: '1',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: false, label: 'uncertainty'},
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
          uncertainty: {include: true, label: 'uncertainty'},
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
          variant: 'outlined',
          label: 'Sample Photograph',
          helperText: 'Take a photo',
        },
        initialValue: null,
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: true, label: 'uncertainty'},
        },
      },
      'Length-mm': {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Longest dimension of sample in mm.',
          variant: 'outlined',
          required: false,
          SelectProps: {},
          name: 'Length-mm',
          label: 'Length (mm)',
          numberType: 'integer',
        },
        initialValue: '',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: true, label: 'uncertainty'},
        },
      },
      'survey-note': {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          fullWidth: true,
          helperText: 'Note comments about survey area here',
          variant: 'outlined',
          required: false,
          multiline: true,
          SelectProps: {},
          id: 'survey-note',
          name: 'survey-note',
          label: 'Survey Note',
          rows: 4,
        },
        initialValue: '',
        access: ['admin'],
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: false, label: 'uncertainty'},
        },
      },
      Type: {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
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
              {label: 'Igneous', value: 'Igneous'},
              {label: 'Metamorphic', value: 'Metamorphic'},
              {label: 'Sedementary', value: 'Sedementary'},
            ],
          },
          name: 'Type',
          label: 'Type',
        },
        initialValue: '',
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: false, label: 'uncertainty'},
        },
      },
      safety_hazard: {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          name: 'safety_hazard',
          id: 'safety_hazard',
          required: false,
          type: 'checkbox',
          label: 'Safety Hazard',
          helperText: 'Selecting this box will alert maintenance (eventually)',
          ElementProps: {
            enableOtherOption: false,
            options: [
              {value: 'true', label: 'Yes'},
              {value: 'false', label: 'No'},
            ],
          },
        },
        initialValue: '',
        access: ['admin'],
        meta: {
          annotation: {include: false, label: 'annotation'},
          uncertainty: {include: false, label: 'uncertainty'},
        },
      },
    },
    views: {
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
        description: 'This description.',
      },
      'Primary-Next-Section': {
        label: 'Identify',
        fields: ['Field-ID', 'Identifier', 'IGSN-QR-Code', 'survey-note'],
        description: 'That description.',
      },
    },
    viewsets: {
      Primary: {
        label: 'Observation',
        views: ['Primary-Next-Section', 'Primary-New-Section'],
        hridField: 'Identifier',
      },
    },
    visible_types: ['Primary'],
    settings: {showQrCodeButton: true},
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  },
  metadata: {
    information: {
      notebookVersion: '1.0',
      purposeMarkdown:
        'Demonstration notebook to help develop an export pipeline from Fieldmark to RSpace.',
      projectLeadLabel: 'Steve Cassidy',
      leadInstitution: 'Fieldmark',
    },
  },
};
