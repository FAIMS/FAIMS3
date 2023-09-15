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
 * Filename: branchingLogic.test.tsx
 */

import {expect, it, describe} from 'vitest';
import {
  get_logic_fields,
  get_logic_views,
  update_by_branching_logic,
} from './branchingLogic';

const testViewName = 'SurveyAreaFormSECTION1';

const testFormType = 'SurveyAreaForm';

const testValuesNoLogic = {
  _id: 'rec-2d2f08c0-1335-4fb2-a5fa-5c77473795da',
  _project_id: 'default||1685527104147-campus-survey-demo',
  _current_revision_id: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
  hridSurveyAreaForm: 'Survey Area: Zone Charlie;  ',
  newfield800c3f33: 'Zone Charlie; ',
  newfield31fa5e828: '',
  newfield530132cf: '1',
  newfield5363dcf4: null,
  newfield323848d82: null,
  newfield8b0ba1cc: '901231',
  newfield59982156: [],
  newfield2574953d: [],
  newfield29872100: null,
  newfield708566a7: '',
  fieldNames: [],
  views: [],
};

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
    newfield323848d82: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield323848d82',
        id: 'newfield323848d82',
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
        template: 'Element: {{newfield5284a817}}-{{newfield3148d0b3e}}',
        InputProps: {
          type: 'text',
          readOnly: true,
        },
        InputLabelProps: {
          label: 'Element ID',
        },
        hrid: true,
        linked: 'newfield218d25ed',
        numberfield: 3,
        fieldselect10: 'A',
        fieldselect11: 'newfield5284a817',
        fieldselect12: 'newfield3148d0b3e',
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
    newfield3148d0b3e: {
      'component-namespace': 'faims-custom',
      'component-name': 'BasicAutoIncrementer',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'newfield3148d0b3e',
        id: 'newfield3148d0b3e',
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
    newfield31bf571: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield31bf571',
        id: 'newfield31bf571',
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
        template: 'Survey Area: {{newfield800c3f33}} {{newfield31fa5e828}}',
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
        fieldselect11: 'newfield31fa5e828',
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
    newfield59982156: {
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
        id: 'newfield59982156',
        name: 'newfield59982156',
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
    newfield31fa5e828: {
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
        id: 'newfield31fa5e828',
        name: 'newfield31fa5e828',
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
    newfield29872100: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'newfield29872100',
        id: 'newfield29872100',
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
    newfield275df5b6: {
      'component-namespace': 'faims-custom',
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool',
      'component-parameters': {
        name: 'newfield275df5b6',
        id: 'newfield275df5b6',
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
    newfield2574953d: {
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
        id: 'newfield2574953d',
        name: 'newfield2574953d',
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
        'newfield31fa5e828',
        'newfield530132cf',
        'newfield5363dcf4',
        'newfield323848d82',
        'newfield8b0ba1cc',
        'newfield59982156',
        'newfield2574953d',
      ],
      uidesign: 'form',
      label: 'Survey Details',
    },
    LandscapeElementFormSECTION1: {
      fields: [
        'hridLandscapeElementForm',
        'newfield3148d0b3e',
        'newfield45892ead',
        'newfield5284a817',
        'newfield31bf571',
        'newfield122849e9',
        'newfield275df5b6',
        'newfield0d7f0350',
        'newfield48b901e2',
        'newfield42b1b859',
      ],
      uidesign: 'form',
      label: 'Description',
    },
    SurveyAreaFormSECTION2: {
      fields: ['newfield29872100', 'newfield708566a7'],
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

const testResultGetField = [
  'hridSurveyAreaForm',
  'newfield800c3f33',
  'newfield31fa5e828',
  'newfield530132cf',
  'newfield5363dcf4',
  'newfield323848d82',
  'newfield8b0ba1cc',
  'newfield59982156',
  'newfield2574953d',
];

const testResultGetLogic = ['SurveyAreaFormSECTION1', 'SurveyAreaFormSECTION2'];

describe('Check branching logic methods', () => {
  it('Check get_field method', () => {
    expect(
      get_logic_fields(testUiSpecification, testValuesNoLogic, testViewName)
    ).toStrictEqual(testResultGetField);
  });

  it('Check get_logic_views method', () => {
    expect(
      get_logic_views(testUiSpecification, testFormType, testValuesNoLogic)
    ).toStrictEqual(testResultGetLogic);
  });

  it('Check update_by_branching_logic method', () => {
    expect(
      update_by_branching_logic(
        testUiSpecification,
        testValuesNoLogic,
        true,
        testResultGetField,
        testResultGetLogic,
        testViewName,
        testFormType,
        {}
      )
    ).toStrictEqual(testResultGetField);
  });
});
