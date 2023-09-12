/*
 * Copyright 2021, 2022 Macquarie University
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
 * Filename: record.test.tsx
 * Description:
 *   TODO
 */

import {
  act,
  cleanup,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import {expect, vi, test, afterEach} from 'vitest';

import Record from './record';

const testProjectInfo = {
  created: 'Unknown',
  description: 'No description',
  is_activated: true,
  last_updated: 'Unknown',
  listing_id: 'default',
  name: 'Test Name',
  non_unique_project_id: 'unique-test-id',
  project_id: 'default||1685527104147-campus-survey-demo',
  status: 'published',
};

const testInitialMergeDetails = {
  initial_head: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
  initial_head_data: {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-2d2f08c0-1335-4fb2-a5fa-5c77473795da',
    revision_id: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
    type: 'SurveyAreaForm',
    updated: '2023-07-04T16:58:26.056Z',
    updated_by: 'admin',
    fields: {
      hridSurveyAreaForm: {
        data: 'Survey Area: Zone Charlie;  ',
        type: 'faims-core::String',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-8d2148e1-c4f4-44d0-8c23-96a36235df94',
      },
      newfield800c3f33: {
        data: 'Zone Charlie; ',
        type: 'faims-core::String',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-2a5f1960-f24e-4543-b466-cf2162346c26',
      },
      newfield3fa5e828: {
        data: '',
        type: 'faims-core::String',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-be59aeba-07bb-4613-bf3b-f96431240ae9',
      },
      newfield530132cf: {
        data: '1',
        type: 'faims-core::JSON',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-bda5f300-6ad2-4717-89e5-98a27806ef93',
      },
      newfield5363dcf4: {
        data: null,
        type: 'faims-pos::Location',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-b000a593-9d56-4060-b724-878c37e766e6',
      },
      newfield13848d82: {
        data: null,
        type: 'faims-pos::Location',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-efb126c0-e585-44e8-a7a7-c8cb241ccf7c',
      },
      newfield8b0ba1cc: {
        data: 'newfield-data',
        type: 'faims-core::String',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-cc2cc985-747c-4718-b5b8-40954c2dcd4a',
      },
      newfield59324156: {
        data: [],
        type: 'faims-core::Relationship',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-57de8924-31c3-4e36-9b42-ed35bddf13cd',
      },
      newfield0574953d: {
        data: [],
        type: 'faims-core::Relationship',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-861fae39-ac2a-4c72-9341-fbfc3a271bf6',
      },
      newfield25421200: {
        data: null,
        type: 'faims-attachment::Files',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-3fe0b505-1b88-4faa-a2e0-8427333d6ca9',
      },
      newfield708566a7: {
        data: '',
        type: 'faims-core::String',
        annotations: {
          annotation: '',
          uncertainty: false,
        },
        created: '2023-07-04T16:36:09.964Z',
        created_by: 'admin',
        avp_id: 'avp-2a8b97e5-dd43-49e0-9f3c-01b56a4cd435',
      },
      fieldNames: {
        data: [],
        type: '??:??',
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-40149ee9-c57a-47a2-8e7e-d241d59120cb',
      },
      views: {
        data: [],
        type: '??:??',
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-262bf490-da6c-42ca-84c9-3dc53d4db60e',
      },
      updateField: {
        data: 'newfield8b0ba1cc',
        type: '??:??',
        created: '2023-07-04T16:58:26.056Z',
        created_by: 'admin',
        avp_id: 'avp-2fb538f6-66e2-4ac5-aabe-082a0be7f9cd',
      },
    },
    deleted: false,
    relationship: {},
  },
  available_heads: {
    'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9': {
      type: 'SurveyAreaForm',
      created: '2023-07-04T16:58:26.056Z',
      created_by: 'admin',
      deleted: false,
    },
  },
};

const testFullRecordData = {
  project_id: 'default||1685527104147-campus-survey-demo',
  record_id: 'rec-2d2f08c0-1335-4fb2-a5fa-5c77473795da',
  revision_id: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
  type: 'SurveyAreaForm',
  data: {
    hridSurveyAreaForm: 'Survey Area: Zone Charlie;  ',
    newfield800c3f33: 'Zone Charlie; ',
    newfield3fa5e828: '',
    newfield530132cf: '1',
    newfield5363dcf4: null,
    newfield13848d82: null,
    newfield8b0ba1cc: 'newfield-data',
    newfield59324156: [],
    newfield0574953d: [],
    newfield25421200: null,
    newfield708566a7: '',
    fieldNames: [],
    views: [],
    updateField: 'newfield8b0ba1cc',
  },
  updated_by: 'admin',
  updated: '2023-07-04T16:58:26.056Z',
  created: '2023-07-04T16:36:09.964Z',
  created_by: 'admin',
  annotations: {
    hridSurveyAreaForm: {
      annotation: '',
      uncertainty: false,
    },
    newfield800c3f33: {
      annotation: '',
      uncertainty: false,
    },
    newfield3fa5e828: {
      annotation: '',
      uncertainty: false,
    },
    newfield530132cf: {
      annotation: '',
      uncertainty: false,
    },
    newfield5363dcf4: {
      annotation: '',
      uncertainty: false,
    },
    newfield13848d82: {
      annotation: '',
      uncertainty: false,
    },
    newfield8b0ba1cc: {
      annotation: '',
      uncertainty: false,
    },
    newfield59324156: {
      annotation: '',
      uncertainty: false,
    },
    newfield0574953d: {
      annotation: '',
      uncertainty: false,
    },
    newfield25421200: {
      annotation: '',
      uncertainty: false,
    },
    newfield708566a7: {
      annotation: '',
      uncertainty: false,
    },
  },
  field_types: {
    hridSurveyAreaForm: 'faims-core::String',
    newfield800c3f33: 'faims-core::String',
    newfield3fa5e828: 'faims-core::String',
    newfield530132cf: 'faims-core::JSON',
    newfield5363dcf4: 'faims-pos::Location',
    newfield13848d82: 'faims-pos::Location',
    newfield8b0ba1cc: 'faims-core::String',
    newfield59324156: 'faims-core::Relationship',
    newfield0574953d: 'faims-core::Relationship',
    newfield25421200: 'faims-attachment::Files',
    newfield708566a7: 'faims-core::String',
    fieldNames: '??:??',
    views: '??:??',
    updateField: '??:??',
  },
  relationship: {},
  deleted: false,
};

const testUISpec = {
  _id: 'ui-specification',
  _rev: '1-34af17ce7b63419f95cd0513a00339fc',
  fields: {
    newfield5363dcf4: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield5363dcf4',
        id: 'newfield5363dcf4',
        helperText: 'Tap to select the starting point for the survey.',
        variant: 'outlined',
        label: 'Take GPS Starting Point',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      is_logic: {
        newfield800c3f33: ['Zone Alpha; ', 'Zone Charlie; '],
      },
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield800c3f33: {
      'component-namespace': 'faims-custom',
      'component-name': 'Select',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText:
          'Select your campus area from the list. (For other, use annotation icon)',
        variant: 'outlined',
        required: false,
        select: true,
        InputProps: {},
        SelectProps: {},
        ElementProps: {
          options: [
            {
              value: 'Zone Alpha; ',
              label: 'Zone Alpha; ',
            },
            {
              value: 'Zone Beta; ',
              label: 'Zone Beta; ',
            },
            {
              value: 'Zone Charlie; ',
              label: 'Zone Charlie; ',
            },
            {
              value: 'Zone Delta; ',
              label: 'Zone Delta; ',
            },
            {
              value: 'Zone Other; ',
              label: 'Zone Other; ',
            },
          ],
        },
        InputLabelProps: {
          label: 'Campus Zone',
        },
        id: 'newfield800c3f33',
        name: 'newfield800c3f33',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'Other area',
        annotation: true,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      logic_select: {
        type: ['field', 'view'],
      },
    },
    newfield8b0ba1cc: {
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
        id: 'newfield8b0ba1cc',
        name: 'newfield8b0ba1cc',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield13848d82: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield13848d82',
        id: 'newfield13848d82',
        helperText: 'Tap to select the end point for the survey.',
        variant: 'outlined',
        label: 'Take GPS End Point',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      is_logic: {
        newfield800c3f33: ['Zone Alpha; ', 'Zone Charlie; '],
      },
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    hridLandscapeElementForm: {
      'component-namespace': 'faims-custom',
      'component-name': 'TemplatedStringField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        name: 'hridLandscapeElementForm',
        id: 'hridLandscapeElementForm',
        helperText:
          'This is unique ID for each landscape element composed from an auto-incrementer and the element type.',
        variant: 'filled',
        required: true,
        template: 'Element: {{newfield5284a817}}-{{newfield348d0b3e}}',
        InputProps: {
          type: 'text',
          readOnly: true,
        },
        InputLabelProps: {
          label: 'Element ID',
        },
        hrid: true,
        linked: 'newfield618d25ed',
        numberfield: 3,
        fieldselect10: 'A',
        fieldselect11: 'newfield5284a817',
        fieldselect12: 'newfield348d0b3e',
      },
      validationSchema: [['yup.string'], ['yup.required']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: true,
        uncertainty: {
          include: true,
          label: 'uncertainty',
        },
      },
    },
    newfield348d0b3e: {
      'component-namespace': 'faims-custom',
      'component-name': 'BasicAutoIncrementer',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'newfield348d0b3e',
        id: 'newfield348d0b3e',
        variant: 'outlined',
        required: true,
        num_digits: 5,
        form_id: 'LandscapeElementFormSECTION1',
        label: 'AutoIncrementer',
      },
      validationSchema: [['yup.string'], ['yup.required']],
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: true,
        uncertainty: {
          include: true,
          label: 'uncertainty',
        },
      },
    },
    newfield5284a817: {
      'component-namespace': 'faims-custom',
      'component-name': 'Select',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText:
          'Select the type of landscape element that you see, e.g. bench seat, street lamp etc. Fill other in annotation.',
        variant: 'outlined',
        required: false,
        select: true,
        InputProps: {},
        SelectProps: {},
        ElementProps: {
          options: [
            {
              value: 'Bench seat',
              label: 'Bench seat',
            },
            {
              value: 'Movable Chair',
              label: 'Movable Chair',
            },
            {
              value: 'Garden bed',
              label: 'Garden bed',
            },
            {
              value: 'Plant',
              label: 'Plant',
            },
            {
              value: 'Rubbish bin',
              label: 'Rubbish bin',
            },
            {
              value: 'Sculpture',
              label: 'Sculpture',
            },
            {
              value: 'Signage',
              label: 'Signage',
            },
            {
              value: 'Street lamp',
              label: 'Street lamp',
            },
            {
              value: 'Table',
              label: 'Table',
            },
            {
              value: 'Tree',
              label: 'Tree',
            },
            {
              value: 'Other',
              label: 'Other',
            },
          ],
        },
        InputLabelProps: {
          label: 'Element Type',
        },
        id: 'newfield5284a817',
        name: 'newfield5284a817',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'Other',
        annotation: true,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield731bf571: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield731bf571',
        id: 'newfield731bf571',
        helperText: '',
        variant: 'outlined',
        label: 'Take GPS Point',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield45892ead: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText:
          'Enter the asset number of the item, if known. In annotation, note difficulties.',
        variant: 'outlined',
        required: false,
        InputProps: {
          type: 'text',
        },
        SelectProps: {},
        InputLabelProps: {
          label: 'Asset number',
        },
        FormHelperTextProps: {},
        id: 'newfield45892ead',
        name: 'newfield45892ead',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'Difficulties',
        annotation: true,
        uncertainty: {
          include: true,
          label: 'Questionable',
        },
      },
    },
    newfield0d7f0350: {
      'component-namespace': 'faims-custom',
      'component-name': 'RadioGroup',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'newfield0d7f0350',
        id: 'newfield0d7f0350',
        variant: 'outlined',
        required: false,
        ElementProps: {
          options: [
            {
              value: 'Good',
              label: 'Good',
              RadioProps: {
                id: 'radio-group-field-0',
              },
            },
            {
              value: ' Satisfactory',
              label: ' Satisfactory',
              RadioProps: {
                id: 'radio-group-field-1',
              },
            },
            {
              value: ' Poor',
              label: ' Poor',
              RadioProps: {
                id: 'radio-group-field-2',
              },
            },
            {
              value: ' Dangerous',
              label: ' Dangerous',
              RadioProps: {
                id: 'radio-group-field-3',
              },
            },
            {
              value: ' Not able to assess ',
              label: ' Not able to assess ',
              RadioProps: {
                id: 'radio-group-field-4',
              },
            },
          ],
        },
        FormLabelProps: {
          children: 'Condition',
        },
        FormHelperTextProps: {
          children:
            'Select an option for the overall condition of the landscape element. Add notes, if needed, in annotation.',
        },
      },
      validationSchema: [['yup.string']],
      initialValue: '1',
      access: ['admin'],
      meta: {
        annotation_label: 'Assessment note',
        annotation: true,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield42b1b859: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'MultipleTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText: 'Add additional description or observations as needed.',
        variant: 'outlined',
        required: false,
        multiline: true,
        InputProps: {
          type: 'text',
          rows: 4,
        },
        SelectProps: {},
        InputLabelProps: {
          label: 'Element Notes',
        },
        FormHelperTextProps: {},
        id: 'newfield42b1b859',
        name: 'newfield42b1b859',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: true,
        uncertainty: {
          include: true,
          label: 'uncertainty',
        },
      },
    },
    newfield48b901e2: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield48b901e2',
        id: 'newfield48b901e2',
        helperText: 'Take a photo',
        variant: 'outlined',
        label: 'Take Photo',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield122849e9: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText:
          'Make a note of the nearest identifiable building. Check uncertain in the field annotation if uncertain.',
        variant: 'outlined',
        required: false,
        InputProps: {},
        SelectProps: {},
        InputLabelProps: {
          label: 'Nearest building',
        },
        FormHelperTextProps: {},
        id: 'newfield122849e9',
        name: 'newfield122849e9',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: true,
          label: 'Uncertain',
        },
      },
    },
    hridSurveyAreaForm: {
      'component-namespace': 'faims-custom',
      'component-name': 'TemplatedStringField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        name: 'hridSurveyAreaForm',
        id: 'hridSurveyAreaForm',
        helperText:
          'A read-only field composited from campus-zone and nickname to make a custom ID.',
        variant: 'filled',
        required: true,
        template: 'Survey Area: {{newfield800c3f33}} {{newfield3fa5e828}}',
        InputProps: {
          type: 'text',
          readOnly: true,
        },
        InputLabelProps: {
          label: 'Survey Area ID',
        },
        hrid: true,
        numberfield: 2,
        fieldselect10: 'newfield800c3f33',
        fieldselect11: 'newfield3fa5e828',
        linked: 'newfield757083da',
      },
      validationSchema: [['yup.string'], ['yup.required']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield59324156: {
      'component-namespace': 'faims-custom',
      'component-name': 'RelatedRecordSelector',
      'type-returned': 'faims-core::Relationship',
      'component-parameters': {
        fullWidth: true,
        helperText:
          'Associate/record new street furniture with this survey area',
        variant: 'outlined',
        required: false,
        related_type: 'LandscapeElementForm',
        relation_type: 'faims-core::Child',
        InputProps: {
          type: 'text',
        },
        multiple: true,
        SelectProps: {},
        InputLabelProps: {
          label: 'Landscape Elements',
        },
        FormHelperTextProps: {},
        id: 'newfield59324156',
        name: 'newfield59324156',
      },
      validationSchema: [['yup.string']],
      initialValue: [],
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield3fa5e828: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText: 'Give a memorable name to your survey area.',
        variant: 'outlined',
        required: false,
        InputProps: {
          type: 'text',
        },
        SelectProps: {},
        InputLabelProps: {
          label: 'Survey Area Nickname',
        },
        FormHelperTextProps: {},
        id: 'newfield3fa5e828',
        name: 'newfield3fa5e828',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield25421200: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield25421200',
        id: 'newfield25421200',
        helperText: 'Take a photo',
        variant: 'outlined',
        label: 'Take Photo',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield708566a7: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'MultipleTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        fullWidth: true,
        helperText: 'Journal entries as needed',
        variant: 'outlined',
        required: false,
        multiline: true,
        InputProps: {
          type: 'text',
          rows: 4,
        },
        SelectProps: {},
        InputLabelProps: {
          label: 'Journal',
        },
        FormHelperTextProps: {},
        id: 'newfield708566a7',
        name: 'newfield708566a7',
      },
      validationSchema: [['yup.string']],
      initialValue: '',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield675df5b6: {
      'component-namespace': 'faims-custom',
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool',
      'component-parameters': {
        name: 'newfield675df5b6',
        id: 'newfield675df5b6',
        required: false,
        type: 'checkbox',
        FormControlLabelProps: {
          label: 'Safety Hazard',
        },
        FormHelperTextProps: {
          children: 'Selecting this box will alert maintenance (eventually)',
        },
      },
      validationSchema: [['yup.bool']],
      initialValue: false,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield530132cf: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {
        name: 'newfield530132cf',
        id: 'newfield530132cf',
        variant: 'outlined',
        required: false,
        featureType: 'Polygon',
        zoom: '',
        label: 'Draw bounding box around survey area',
        FormLabelProps: {
          children: 'Survey Area Polygon',
        },
      },
      validationSchema: [['yup.string']],
      initialValue: '1',
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: false,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
    newfield0574953d: {
      'component-namespace': 'faims-custom',
      'component-name': 'RelatedRecordSelector',
      'type-returned': 'faims-core::Relationship',
      'component-parameters': {
        fullWidth: true,
        helperText: 'Select or Add new related survey area',
        variant: 'outlined',
        required: false,
        related_type: 'SurveyAreaForm',
        relation_type: 'faims-core::Linked',
        InputProps: {
          type: 'text',
        },
        multiple: true,
        SelectProps: {},
        InputLabelProps: {
          label: 'Related Survey Area',
        },
        FormHelperTextProps: {},
        id: 'newfield0574953d',
        name: 'newfield0574953d',
        relation_linked_vocabPair: [
          ['performed after', 'performed before'],
          ['is similar to', 'is similar to'],
          ['overlaps with', 'is overlapped by'],
        ],
        related_type_label: 'Area',
        current_form: 'SurveyAreaForm',
        current_form_label: 'Area',
      },
      validationSchema: [['yup.string']],
      initialValue: [],
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: true,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    },
  },
  views: {
    SurveyAreaFormSECTION1: {
      fields: [
        'hridSurveyAreaForm',
        'newfield800c3f33',
        'newfield3fa5e828',
        'newfield530132cf',
        'newfield5363dcf4',
        'newfield13848d82',
        'newfield8b0ba1cc',
        'newfield59324156',
        'newfield0574953d',
      ],
      uidesign: 'form',
      label: 'Survey Details',
    },
    LandscapeElementFormSECTION1: {
      fields: [
        'hridLandscapeElementForm',
        'newfield348d0b3e',
        'newfield45892ead',
        'newfield5284a817',
        'newfield731bf571',
        'newfield122849e9',
        'newfield675df5b6',
        'newfield0d7f0350',
        'newfield48b901e2',
        'newfield42b1b859',
      ],
      uidesign: 'form',
      label: 'Description',
    },
    SurveyAreaFormSECTION2: {
      fields: ['newfield25421200', 'newfield708566a7'],
      uidesign: 'form',
      label: 'Journal',
      is_logic: {
        newfield800c3f33: ['Zone Beta; ', 'Zone Charlie; '],
      },
    },
  },
  viewsets: {
    SurveyAreaForm: {
      views: ['SurveyAreaFormSECTION1', 'SurveyAreaFormSECTION2'],
      label: 'Survey Area',
    },
    LandscapeElementForm: {
      views: ['LandscapeElementFormSECTION1'],
      label: 'Landscape Element',
    },
  },
  visible_types: ['SurveyAreaForm', 'LandscapeElementForm'],
};

function mockListFAIMSRecordRevisions() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
        'frev-7e3ec565-aa2a-481e-bc4c-444c45c0b051',
      ]);
    });
  });
}

function mockGetHRIDforRecordID() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('Survey Area: Zone Charlie;  ');
    });
  });
}

function mockGetInitialMergeDetails() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(testInitialMergeDetails);
    });
  });
}

function mockFindConflictingFields() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([]);
    });
  });
}

function mockGetFullRecordData() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(testFullRecordData);
    });
  });
}

function mockGetDetailRelatedInformation() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([]);
    });
  });
}

function mockGetParentPersistenceData() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([]);
    });
  });
}

function mockGetUiSpecForProject() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(testUISpec);
    });
  });
}

function mockGetProjectMetadata() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        SurveyAreaFormSECTION1: {
          sectiondescriptionSurveyAreaFormSECTION1:
            'Here you will describe the survey session.',
        },
      });
    });
  });
}

afterEach(() => {
  cleanup();
});

vi.mock('react-router-dom', () => {
  return {
    useParams: () => ({
      project_id: testProjectInfo.project_id,
      record_id: 'rec-2d2f08c0-1335-4fb2-a5fa-5c77473795da',
      revision_id: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
    }),
    useNavigate: vi.fn(() => {}),
    Link: vi.fn(() => {}), // this prevents the project name appearing
    RouterLink: vi.fn(() => {}),
  };
});

vi.mock('../../uiSpecification', () => ({
  getUiSpecForProject: mockGetUiSpecForProject,
}));

vi.mock('faims3-datamodel', () => ({
  listFAIMSRecordRevisions: mockListFAIMSRecordRevisions,
  getHRIDforRecordID: mockGetHRIDforRecordID,
  setAttachmentLoaderForType: vi.fn(() => {}),
  setAttachmentDumperForType: vi.fn(() => {}),
  getInitialMergeDetails: mockGetInitialMergeDetails,
  findConflictingFields: mockFindConflictingFields,
  getFullRecordData: mockGetFullRecordData,
  getDetailRelatedInformation: mockGetDetailRelatedInformation,
  getParentPersistenceData: mockGetParentPersistenceData,
  file_data_to_attachments: vi.fn(() => {}),
  file_attachments_to_data: vi.fn(() => {}),
}));

vi.mock('../../projectMetadata', () => ({
  getProjectMetadata: mockGetProjectMetadata,
}));

// jest.setTimeout(20000);

test('Check record component', async () => {
  act(() => {
    render(<Record />);
  });

  expect(screen.getByTestId('progressbar')).toBeTruthy();

  await waitForElementToBeRemoved(() => screen.getByTestId('progressbar'), {
    timeout: 3000,
  });

  expect(screen.getByText('Loading...')).toBeTruthy();
});
