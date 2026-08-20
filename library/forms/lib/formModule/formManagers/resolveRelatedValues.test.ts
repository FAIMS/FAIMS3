import type {DataEngine, UiSpecModel} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {resolveRelatedValues} from './resolveRelatedValues';

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

const numberField = (label: string, name: string) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'NumberField',
  'type-returned': 'faims-core::Number',
  'component-parameters': {label, name, required: false},
  validationSchema: [['yup.number']],
  initialValue: null,
  meta,
  condition: null,
  persistent: false,
});

const link = (
  target: string,
  {multiple = false, relation = 'faims-core::Linked'} = {}
) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'RelatedRecordSelector',
  'type-returned': 'faims-core::Relationship',
  'component-parameters': {
    name: 'core-calibration',
    label: 'Core Calibration',
    related_type: target,
    relation_type: relation,
    multiple,
  },
  validationSchema: [],
  initialValue: null,
  meta,
  condition: null,
  persistent: false,
});

// TEST links one CALIBRATION record; also holds a multi-link and a Child link.
function makeUiSpec(): UiSpecModel {
  return {
    fields: {
      'Wet-Mass-g': numberField('Wet Mass', 'wet-mass'),
      'Core-Calibration': link('CALIBRATION'),
      Photos: link('PHOTO', {multiple: true}),
      Samples: link('SAMPLE', {relation: 'faims-core::Child'}),
      'Cutter-Mass-g': numberField('Cutter Mass', 'cutter-mass'),
      'Photo-Note': numberField('Photo Note', 'photo-note'),
      'Sample-Note': numberField('Sample Note', 'sample-note'),
    },
    views: {
      'TEST-v1': {
        label: 'Test',
        fields: ['Wet-Mass-g', 'Core-Calibration', 'Photos', 'Samples'],
      },
      'CALIBRATION-v1': {label: 'Calibration', fields: ['Cutter-Mass-g']},
      'PHOTO-v1': {label: 'Photo', fields: ['Photo-Note']},
      'SAMPLE-v1': {label: 'Sample', fields: ['Sample-Note']},
    },
    viewsets: {
      TEST: {label: 'Test', views: ['TEST-v1']},
      CALIBRATION: {label: 'Calibration', views: ['CALIBRATION-v1']},
      PHOTO: {label: 'Photo', views: ['PHOTO-v1']},
      SAMPLE: {label: 'Sample', views: ['SAMPLE-v1']},
    },
    visible_types: ['TEST', 'CALIBRATION', 'PHOTO', 'SAMPLE'],
  } as UiSpecModel;
}

type StubRecord = {formId: string; data: Record<string, {data: unknown}>};

function makeEngine(
  records: Record<string, StubRecord>,
  {fail}: {fail?: boolean} = {}
): DataEngine {
  return {
    uiSpec: makeUiSpec(),
    form: {
      getExistingFormData: async ({recordId}: {recordId: string}) => {
        if (fail) throw new Error('boom');
        const r = records[recordId];
        if (!r) throw new Error('not found');
        return r;
      },
    },
  } as unknown as DataEngine;
}

const calibration: StubRecord = {
  formId: 'CALIBRATION',
  data: {'Cutter-Mass-g': {data: 42}},
};
const linkTo = (record_id: string) => ({
  record_id,
  project_id: 'p',
  relation_type_vocabPair: ['is related to', 'is related to'],
});

describe('resolveRelatedValues', () => {
  it('returns unwrapped raw values keyed by the link field', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({'rec-cal': calibration}),
      values: {'Core-Calibration': linkTo('rec-cal')},
      formId: 'TEST',
    });
    expect(values).toEqual({'Core-Calibration': {'Cutter-Mass-g': 42}});
  });

  it('accepts a one-entry array as a single link', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({'rec-cal': calibration}),
      values: {'Core-Calibration': [linkTo('rec-cal')]},
      formId: 'TEST',
    });
    expect(values['Core-Calibration']?.['Cutter-Mass-g']).toBe(42);
  });

  it('contributes nothing when the field has no link', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({'rec-cal': calibration}),
      values: {'Core-Calibration': null},
      formId: 'TEST',
    });
    expect(values).toEqual({});
  });

  it('ignores multi-link and Child fields even when linked', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({
        'rec-photo': {formId: 'PHOTO', data: {'Photo-Note': {data: 1}}},
        'rec-sample': {formId: 'SAMPLE', data: {'Sample-Note': {data: 2}}},
      }),
      values: {
        Photos: [linkTo('rec-photo')],
        Samples: linkTo('rec-sample'),
      },
      formId: 'TEST',
    });
    expect(values).toEqual({});
  });

  it('skips a link to a record of the wrong form', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({
        'rec-other': {formId: 'PHOTO', data: {'Photo-Note': {data: 1}}},
      }),
      values: {'Core-Calibration': linkTo('rec-other')},
      formId: 'TEST',
    });
    expect(values).toEqual({});
  });

  it('skips a link that fails to load, without throwing', async () => {
    const values = await resolveRelatedValues({
      engine: makeEngine({}, {fail: true}),
      values: {'Core-Calibration': linkTo('rec-cal')},
      formId: 'TEST',
    });
    expect(values).toEqual({});
  });
});
