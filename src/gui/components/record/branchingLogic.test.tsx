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
import {getFieldsMatchingCondition} from './branchingLogic';
import {
  compileUiSpecConditionals,
  getFieldsForView,
} from '../../../uiSpecification';

const testValues = {
  _id: 'rec-2d2f08c0-1335-4fb2-a5fa-5c77473795da',
  _project_id: 'default||1685527104147-campus-survey-demo',
  _current_revision_id: 'frev-2e0743b1-9710-488b-a462-4fdd90cca0d9',
  hridSurveyAreaForm: 'Survey Area: Zone Charlie;  ',
  conditional_source: 'Zone Charlie; ',
  area_name: '',
  map_polygon: '1',
  take_point1: null,
  take_point_conditional: null,
  mtext: '901231',
  related_record: [],
  related_survey_area: [],
  take_photo2: null,
  journal: '',
  fieldNames: [],
  views: [],
};

const testUiSpecification = {
  _id: 'ui-specification',
  _rev: '1-34af17ce7b63419f95cd0513a00339fc',
  fields: {
    take_point1: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'take_point1',
        id: 'take_point1',
        helperText: 'Tap to select the starting point for the survey.',
        variant: 'outlined',
        label: 'Take GPS Starting Point',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      is_logic: {
        conditional_source: ['Zone Alpha; ', 'Zone Charlie; '],
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
    conditional_source: {
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
        id: 'conditional_source',
        name: 'conditional_source',
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
    mtext: {
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
        id: 'mtext',
        name: 'mtext',
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
    take_point_conditional: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'take_point_conditional',
        id: 'take_point_conditional',
        helperText: 'Tap to select the end point for the survey.',
        variant: 'outlined',
        label: 'Take GPS End Point',
      },
      validationSchema: [['yup.object'], ['yup.nullable']],
      condition: {
        operator: 'or',
        conditions: [
          {
            operator: 'equal',
            field: 'conditional_source',
            value: 'Zone Alpha; ',
          },
          {
            operator: 'equal',
            field: 'conditional_source',
            value: 'Zone Charlie; ',
          },
        ],
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
        template: 'Element: {{select2}}-{{autoInc}}',
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
        fieldselect11: 'select2',
        fieldselect12: 'autoInc',
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
    autoInc: {
      'component-namespace': 'faims-custom',
      'component-name': 'BasicAutoIncrementer',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'autoInc',
        id: 'autoInc',
        variant: 'outlined',
        required: true,
        num_digits: 5,
        form_id: 'view_show_if_alpha',
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
    select2: {
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
        id: 'select2',
        name: 'select2',
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
    take_point3: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        fullWidth: true,
        name: 'take_point3',
        id: 'take_point3',
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
    asset_number: {
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
        id: 'asset_number',
        name: 'asset_number',
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
    radio1: {
      'component-namespace': 'faims-custom',
      'component-name': 'RadioGroup',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'radio1',
        id: 'radio1',
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
    description: {
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
        id: 'description',
        name: 'description',
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
    take_photo: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'take_photo',
        id: 'take_photo',
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
    nearest_bldg: {
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
        id: 'nearest_bldg',
        name: 'nearest_bldg',
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
        template: 'Survey Area: {{conditional_source}} {{area_name}}',
        InputProps: {
          type: 'text',
          readOnly: true,
        },
        InputLabelProps: {
          label: 'Survey Area ID',
        },
        hrid: true,
        numberfield: 2,
        fieldselect10: 'conditional_source',
        fieldselect11: 'area_name',
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
    related_record: {
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
        id: 'related_record',
        name: 'related_record',
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
    area_name: {
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
        id: 'area_name',
        name: 'area_name',
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
    take_photo2: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        fullWidth: true,
        name: 'take_photo2',
        id: 'take_photo2',
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
    journal: {
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
        id: 'journal',
        name: 'journal',
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
    map_polygon: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {
        name: 'map_polygon',
        id: 'map_polygon',
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
    related_survey_area: {
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
        id: 'related_survey_area',
        name: 'related_survey_area',
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
    view_always_shown: {
      fields: [
        'hridSurveyAreaForm',
        'conditional_source',
        'area_name',
        'map_polygon',
        'take_point1',
        'take_point_conditional',
        'mtext',
        'related_record',
        'related_survey_area',
      ],
      uidesign: 'form',
      label: 'Survey Details',
    },
    view_show_if_alpha: {
      fields: [
        'hridLandscapeElementForm',
        'autoInc',
        'asset_number',
        'select2',
        'take_point3',
        'nearest_bldg',
        'safety_hazard',
        'radio1',
        'take_photo',
        'description',
      ],
      uidesign: 'form',
      label: 'Description',
      is_logic: {
        conditional_source: ['Zone Alpha; '],
      },
    },
    view_show_if_beta_charlie: {
      fields: ['take_photo2', 'journal'],
      uidesign: 'form',
      label: 'Journal',
      condition: {
        operator: 'or',
        conditions: [
          {
            operator: 'equal',
            field: 'conditional_source',
            value: 'Zone Beta; ',
          },
          {
            operator: 'equal',
            field: 'conditional_source',
            value: 'Zone Charlie; ',
          },
        ],
      },
    },
  },
  viewsets: {
    SurveyAreaForm: {
      views: [
        'view_always_shown',
        'view_show_if_alpha',
        'view_show_if_beta_charlie',
      ],
      label: 'Survey Area',
    },
  },
  visible_types: ['SurveyAreaForm'],
};

compileUiSpecConditionals(testUiSpecification);

describe('Check branching logic methods', () => {
  it('Check getFieldsMatchingCondition method', () => {
    const targetViewName = 'view_always_shown';
    const fieldNames = getFieldsForView(testUiSpecification, targetViewName);
    expect(
      // test field selection, zone alpha should include all fields
      getFieldsMatchingCondition(
        testUiSpecification,
        {...testValues, conditional_source: 'Zone Alpha; '},
        fieldNames,
        targetViewName,
        {conditional_source: true}
      )
    ).toStrictEqual(fieldNames);

    expect(
      // test field selection, zone charlie should include all fields
      getFieldsMatchingCondition(
        testUiSpecification,
        {...testValues, conditional_source: 'Zone Charlie; '},
        fieldNames,
        targetViewName,
        {conditional_source: true}
      )
    ).toStrictEqual(fieldNames);

    expect(
      // test field selection, zone delta should exclude take_point_conditional
      getFieldsMatchingCondition(
        testUiSpecification,
        {...testValues, conditional_source: 'Zone Delta; '},
        fieldNames,
        targetViewName,
        {conditional_source: true}
      )
    ).not.toContain('take_point_conditional');
  });
});
