import {
  compileUiSpecConditionals,
  UiSpecModel,
  recomputeDerivedFields,
  recomputeComputedFields,
} from '../src';

// Test links one Calibration record via a single-link Linked field.
const makeSpec = (): UiSpecModel => {
  const spec: any = {
    viewsets: {
      Calibration: {views: ['Calibration-view'], label: 'Calibration'},
      Test: {views: ['Test-view'], label: 'Test'},
    },
    views: {
      'Calibration-view': {
        fields: ['Cutter-ID', 'Cutter-Mass-g', 'Cutter-HRID'],
        label: 'Calibration',
      },
      'Test-view': {
        fields: [
          'Test-Note',
          'Wet-Mass-g',
          'Core-Calibration',
          'Test-Label',
          'Soil-Mass-g',
        ],
        label: 'Test',
      },
    },
    fields: {
      'Cutter-ID': field('faims-core::String'),
      'Cutter-Mass-g': field('faims-core::Number'),
      // A derived field on the linked record - deliberately referenceable.
      'Cutter-HRID': field('faims-core::String', 'TemplatedStringField'),
      'Test-Note': field('faims-core::String'),
      'Wet-Mass-g': field('faims-core::Number'),
      'Core-Calibration': {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        'component-parameters': {
          related_type: 'Calibration',
          relation_type: 'faims-core::Linked',
          multiple: false,
        },
      },
      'Test-Label': {
        ...field('faims-core::String', 'TemplatedStringField'),
        'component-parameters': {
          template: '{{Core-Calibration.Cutter-ID}} / {{Test-Note}}',
        },
      },
      'Soil-Mass-g': {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {
          expression: '{Wet-Mass-g} - {Core-Calibration.Cutter-Mass-g}',
        },
      },
    },
  };
  compileUiSpecConditionals(spec);
  return spec as UiSpecModel;
};

function field(typeReturned: string, componentName = 'TextField') {
  return {
    'component-namespace': 'faims-custom',
    'component-name': componentName,
    'type-returned': typeReturned,
    'component-parameters': {},
  };
}

const link = {record_id: 'rec-cal', relation_type_vocabPair: ['a', 'b']};

describe('templated strings with related record references', () => {
  it('renders linked values via {{Rel-Field-ID.Field-ID}}', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Test-Note': 'T1', 'Core-Calibration': link},
      uiSpecification: makeSpec(),
      formId: 'Test',
      context: {relatedValues: {'Core-Calibration': {'Cutter-ID': 'CC-7'}}},
    });
    expect(updates['Test-Label']).toBe('CC-7 / T1');
  });

  it('renders empty when nothing is linked', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Test-Note': 'T1'},
      uiSpecification: makeSpec(),
      formId: 'Test',
      context: {},
    });
    expect(updates['Test-Label']).toBe(' / T1');
  });

  it('can reference a derived field on the linked record', () => {
    const spec = makeSpec();
    (spec.fields['Test-Label']['component-parameters'] as any).template =
      '{{Core-Calibration.Cutter-HRID}}-x';
    compileUiSpecConditionals(spec);
    const {updates} = recomputeDerivedFields({
      values: {'Core-Calibration': link},
      uiSpecification: spec,
      formId: 'Test',
      context: {
        relatedValues: {'Core-Calibration': {'Cutter-HRID': 'CAL-001'}},
      },
    });
    expect(updates['Test-Label']).toBe('CAL-001-x');
  });
});

describe('computed fields with related record references', () => {
  it('resolves linked values into the expression scope', () => {
    const {updates} = recomputeComputedFields({
      values: {'Wet-Mass-g': 100, 'Core-Calibration': link},
      uiSpecification: makeSpec(),
      formId: 'Test',
      context: {relatedValues: {'Core-Calibration': {'Cutter-Mass-g': 42}}},
    });
    expect(updates['Soil-Mass-g']).toBe(58);
  });

  it('coerces linked number values arriving as strings', () => {
    const {updates} = recomputeComputedFields({
      values: {'Wet-Mass-g': 100, 'Core-Calibration': link},
      uiSpecification: makeSpec(),
      formId: 'Test',
      context: {relatedValues: {'Core-Calibration': {'Cutter-Mass-g': '42'}}},
    });
    expect(updates['Soil-Mass-g']).toBe(58);
  });

  it('yields blank when the linked value is missing', () => {
    const {updates, changes} = recomputeComputedFields({
      values: {'Wet-Mass-g': 100, 'Soil-Mass-g': 58},
      uiSpecification: makeSpec(),
      formId: 'Test',
      context: {},
    });
    // Previously computed value clears to null when the link is gone.
    expect(changes).toBe(true);
    expect(updates['Soil-Mass-g']).toBeNull();
  });

  it('yields blank with no context at all', () => {
    const {updates} = recomputeComputedFields({
      values: {'Wet-Mass-g': 100},
      uiSpecification: makeSpec(),
      formId: 'Test',
    });
    expect(updates['Soil-Mass-g'] ?? null).toBeNull();
  });
});
