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
 * Filename: form.test.tsx
 * Description:
 *   Record/Draft form file
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import RecordForm from './form';
import {BrowserRouter} from 'react-router-dom';
import {savefieldpersistentSetting} from './fieldPersistentSetting';
import {getFullRecordData} from 'faims3-datamodel';
import {compileUiSpecConditionals} from '../../../uiSpecification';
import {expect, vi, afterEach, describe, it} from 'vitest';

const testProjectId = 'default||1685527104147-campus-survey-demo';

const testRecordId = 'rec-c891efeb-5d16-4f8e-848c-1428ef30bc46';

const testTypeName = 'SurveyAreaForm';

const testDraftId = 'drf-150611c6-f161-4bd3-8733-8fb0e7627313';

const testMetaSection = {
  SurveyAreaFormSECTION1: {
    sectiondescriptionSurveyAreaFormSECTION1:
      'Here you will describe the survey session.',
  },
};

const testDraftLastSaved =
  'Thu Jun 29 2023 20:07:13 GMT+0300 (Eastern European Summer Time)';

const testUiSpecification = {
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
    newfield92848d82: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield92848d82',
        id: 'newfield92848d82',
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
        template: 'Element: {{newfield9284a817}}-{{newfield648d0b3e}}',
        InputProps: {
          type: 'text',
          readOnly: true,
        },
        InputLabelProps: {
          label: 'Element ID',
        },
        hrid: true,
        linked: 'newfield118d25ed',
        numberfield: 3,
        fieldselect10: 'A',
        fieldselect11: 'newfield9284a817',
        fieldselect12: 'newfield648d0b3e',
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
    newfield648d0b3e: {
      'component-namespace': 'faims-custom',
      'component-name': 'BasicAutoIncrementer',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'newfield648d0b3e',
        id: 'newfield648d0b3e',
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
    newfield9284a817: {
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
        id: 'newfield9284a817',
        name: 'newfield9284a817',
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
    newfield231bf571: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield231bf571',
        id: 'newfield231bf571',
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
        template: 'Survey Area: {{newfield800c3f33}} {{newfield6fa5e828}}',
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
        fieldselect11: 'newfield6fa5e828',
        linked: 'newfield157083da',
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
    newfield59382156: {
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
        id: 'newfield59382156',
        name: 'newfield59382156',
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
    newfield6fa5e828: {
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
        id: 'newfield6fa5e828',
        name: 'newfield6fa5e828',
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
    newfield23821200: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield23821200',
        id: 'newfield23821200',
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
    newfield108566a7: {
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
        id: 'newfield108566a7',
        name: 'newfield108566a7',
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
    newfield175df5b6: {
      'component-namespace': 'faims-custom',
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool',
      'component-parameters': {
        name: 'newfield175df5b6',
        id: 'newfield175df5b6',
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
    newfield7574953d: {
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
        id: 'newfield7574953d',
        name: 'newfield7574953d',
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
        'newfield6fa5e828',
        'newfield530132cf',
        'newfield5363dcf4',
        'newfield92848d82',
        'newfield8b0ba1cc',
        'newfield59382156',
        'newfield7574953d',
      ],
      uidesign: 'form',
      label: 'Survey Details',
    },
    LandscapeElementFormSECTION1: {
      fields: [
        'hridLandscapeElementForm',
        'newfield648d0b3e',
        'newfield45892ead',
        'newfield9284a817',
        'newfield231bf571',
        'newfield122849e9',
        'newfield175df5b6',
        'newfield0d7f0350',
        'newfield48b901e2',
        'newfield42b1b859',
      ],
      uidesign: 'form',
      label: 'Description',
    },
    SurveyAreaFormSECTION2: {
      fields: ['newfield23821200', 'newfield108566a7'],
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

compileUiSpecConditionals(testUiSpecification);

const testValidationSchema = {
  _deps: [],
  _conditions: [],
  _options: {
    abortEarly: true,
    recursive: true,
  },
  _exclusive: {},
  _whitelist: {
    list: {},
    refs: {},
  },
  _blacklist: {
    list: {},
    refs: {},
  },
  tests: [],
  transforms: [null],
  type: 'object',
  _type: 'object',
  fields: {
    hridSurveyAreaForm: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {
        required: true,
      },
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [null],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield800c3f33: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield6fa5e828: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield530132cf: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield5363dcf4: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'object',
      _type: 'object',
      fields: {},
      _nodes: [],
      _excludedEdges: [],
      _nullable: true,
    },
    newfield92848d82: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'object',
      _type: 'object',
      fields: {},
      _nodes: [],
      _excludedEdges: [],
      _nullable: true,
    },
    newfield8b0ba1cc: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield59382156: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield7574953d: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
    newfield23821200: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'object',
      _type: 'object',
      fields: {},
      _nodes: [],
      _excludedEdges: [],
      _nullable: true,
    },
    newfield108566a7: {
      _deps: [],
      _conditions: [],
      _options: {
        abortEarly: true,
        recursive: true,
      },
      _exclusive: {},
      _whitelist: {
        list: {},
        refs: {},
      },
      _blacklist: {
        list: {},
        refs: {},
      },
      tests: [],
      transforms: [null],
      type: 'string',
      _type: 'string',
    },
  },
  _nodes: [
    'newfield108566a7',
    'newfield23821200',
    'newfield7574953d',
    'newfield59382156',
    'newfield8b0ba1cc',
    'newfield92848d82',
    'newfield5363dcf4',
    'newfield530132cf',
    'newfield6fa5e828',
    'newfield800c3f33',
    'hridSurveyAreaForm',
  ],
  _excludedEdges: [],
};

const testRecordsByType = [
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-0501f69c-8060-46b7-accb-331fd4c4bbf7',
    record_label: 'Survey Area:  AppiumUser222222221',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-077a6830-e3ff-4c8d-aca9-da922ba755f6',
    record_label: 'Survey Area:  AppiumUser',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-42e12a8c-3a25-4464-becb-b8ed35dd5007',
    record_label: 'Survey Area:  ',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-43daa632-a6d8-4ece-8edd-2f1bcc40690e',
    record_label: 'Survey Area: Zone Charlie;  Super Charlie',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-5c1bfee4-d7fa-41ec-b578-f157fe5fe8f4',
    record_label: 'Survey Area: Zone Alpha;  bbs purple',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-7794dae5-069f-49b8-8748-2dd17e27fcf1',
    record_label: 'Survey Area: Zone Alpha;  bbs',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-91762d2e-2662-42ce-9a1f-12e51648b123',
    record_label: 'Survey Area: Zone Beta;  ',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-91bfdfef-6c31-433a-9047-4ede00454793',
    record_label: 'Survey Area: Zone Delta;  test',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-9a3ad64c-e805-4d34-b806-1494b89a4b84',
    record_label: 'Survey Area: Zone Alpha;  test',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-cc6faaea-2ea1-4eaa-9b6d-61a7bef2347e',
    record_label: 'Survey Area: Zone Beta;  ',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-cf3e9b8c-d472-4265-b62f-6839ce1fd535',
    record_label: 'Survey Area: Zone Beta;  s',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-d203f6b1-d6f5-4095-bfdb-4b1b945acf9a',
    record_label: 'Survey Area: Zone Alpha;  Salman2',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-f123f190-d085-4a47-85f4-041e5ff82e64',
    record_label: 'Survey Area: Zone Alpha;  salman',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
  {
    project_id: 'default||1685527104147-campus-survey-demo',
    record_id: 'rec-f40bbb21-8a6a-4852-ab60-f08448121a73',
    record_label: 'Survey Area: Zone Beta;  222222',
    relation_type_vocabPair: ['is related to', 'is related to'],
  },
];

function mockGetFirstRecordHead() {
  return new Promise(resolve => {
    resolve('test-data-id');
  });
}

function mockGetRecordsByType() {
  return new Promise(resolve => {
    resolve(testRecordsByType);
  });
}

function mockGetCurrentUserId() {
  return new Promise(resolve => {
    resolve('test-user-id');
  });
}

function mockUpsertFAIMSData() {
  return new Promise(resolve => {
    resolve('frev-7df65c88-ac9a-4457-9814-e586e798f592');
  });
}

afterEach(() => {
  cleanup();
});

vi.mock('faims3-datamodel', () => ({
  getFirstRecordHead: mockGetFirstRecordHead,
  getRecordsByType: mockGetRecordsByType,
  getFullRecordData: vi.fn(() => {}).mockReturnValue(undefined),
  setAttachmentLoaderForType: vi.fn(() => {}),
  setAttachmentDumperForType: vi.fn(() => {}),
  generateFAIMSDataID: vi.fn(() => {}),
  upsertFAIMSData: mockUpsertFAIMSData,
  file_data_to_attachments: vi.fn(() => {}),
  file_attachments_to_data: vi.fn(() => {}),
}));

// need doMock here to enable use of the global variable
vi.doMock('../validation', () => ({
  getValidationSchemaForViewset: vi.fn().mockReturnValue(testValidationSchema),
}));

vi.mock('./fieldPersistentSetting', () => ({
  savefieldpersistentSetting: vi.fn(() => {}),
}));

// vi.mock('../../../uiSpecification', () => ({
//   getReturnedTypesForViewSet: vi.fn(() => {}),
//   getFieldsForViewSet: vi.fn(() => []),
//   getFieldNamesFromFields: vi.fn(() => []),
//   getFieldsForView: vi.fn(() => []),
//   getViewsForViewSet: vi.fn(() => []),
// }));

vi.mock('./relationships/RelatedInformation', () => ({
  getParentLink_from_relationship: vi.fn(() => {}),
  getParentlinkInfo: vi.fn(() => {}),
  get_RelatedFields_for_field: vi.fn(() => {}),
}));

vi.mock('../../../users', () => ({
  getCurrentUserId: mockGetCurrentUserId,
}));

// jest.setTimeout(20000);

describe('Check form component', () => {
  window.scrollTo = vi.fn(() => {});
  it('Check form component', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );

    expect(
      screen.getAllByText(
        testUiSpecification.fields.hridSurveyAreaForm['component-parameters']
          .InputLabelProps.label
      )
    ).toBeTruthy();

    const campusSelect = screen.getByLabelText(
      testUiSpecification.fields.newfield800c3f33['component-parameters']
        .InputLabelProps.label
    );

    expect(campusSelect).toBeTruthy();

    expect(
      screen.getByText(
        testUiSpecification.fields.newfield6fa5e828['component-parameters']
          .helperText
      )
    ).toBeTruthy();

    expect(
      screen.getByText(
        testUiSpecification.fields.newfield530132cf['component-parameters']
          .label
      )
    ).toBeTruthy();

    expect(
      screen.getByText(
        testUiSpecification.fields.newfield8b0ba1cc['component-parameters']
          .helperText
      )
    ).toBeTruthy();

    expect(
      screen.getByText(
        testUiSpecification.fields.newfield59382156['component-parameters']
          .InputLabelProps.label
      )
    ).toBeTruthy();

    expect(
      screen.getByText(
        testUiSpecification.fields.newfield7574953d['component-parameters']
          .InputLabelProps.label
      )
    ).toBeTruthy();
  });

  it('Check Publish and continue editing button', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );

    const editBtn = screen.getByText('Publish and continue editing');

    expect(editBtn).toBeTruthy();

    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(savefieldpersistentSetting).toBeCalled();
    });

    await waitFor(() => {
      expect(getFullRecordData).toBeCalled();
    });
  });
  it('Check Publish and Close Record button', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );

    const closeBtn = screen.getByTestId('publish-close-record');

    expect(closeBtn).toBeTruthy();

    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(savefieldpersistentSetting).toBeCalled();
    });
  });

  it('Check Publish and New Record button', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );

    const newRecordBtn = screen.getByText('Publish and New Record');

    expect(newRecordBtn).toBeTruthy();

    fireEvent.click(newRecordBtn);

    await waitFor(() => {
      expect(savefieldpersistentSetting).toBeCalled();
    });

    await waitFor(() => {
      expect(getFullRecordData).toBeCalled();
    });
  });
  it('Check text field newfield8b0ba1cc', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );
    const inputNewfield8b0ba1cc = screen
      .getByTestId('newfield8b0ba1cc')
      .querySelector('#newfield8b0ba1cc');
    inputNewfield8b0ba1cc
      ? fireEvent.change(inputNewfield8b0ba1cc, {target: {value: 'Test text'}})
      : null;

    inputNewfield8b0ba1cc
      ? expect((inputNewfield8b0ba1cc as HTMLTextAreaElement).value).toBe(
          'Test text'
        )
      : null;

    await waitFor(() => {
      expect(getFullRecordData).toBeCalled();
    });
  });

  it('Check text field newfield6fa5e828', async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RecordForm
            project_id={testProjectId}
            ui_specification={testUiSpecification}
            record_id={testRecordId}
            type={testTypeName}
            draft_id={testDraftId}
            metaSection={testMetaSection}
            handleSetIsDraftSaving={vi.fn(() => {})}
            handleSetDraftLastSaved={vi.fn(() => {})}
            handleSetDraftError={vi.fn(() => {})}
            draftLastSaved={testDraftLastSaved}
            navigate={vi.fn(() => {})}
          />
        </BrowserRouter>
      );
    });
    expect(screen.getByText('Loading record data')).toBeTruthy();

    await waitForElementToBeRemoved(
      () => screen.getByTestId('circular-loading'),
      {timeout: 3000}
    );
    const inputNewfield8b0ba1cc = screen
      .getByTestId('newfield6fa5e828')
      .querySelector('#newfield6fa5e828');

    inputNewfield8b0ba1cc
      ? fireEvent.change(inputNewfield8b0ba1cc, {target: {value: 'Test text'}})
      : null;

    inputNewfield8b0ba1cc
      ? expect((inputNewfield8b0ba1cc as HTMLTextAreaElement).value).toBe(
          'Test text'
        )
      : null;

    await waitFor(() => {
      expect(getFullRecordData).toBeCalled();
    });
  });
});
