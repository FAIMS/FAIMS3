import {describe, expect, it} from 'vitest';
import {compileUiSpecConditionals, UiSpecModel} from '@faims3/data-model';
import {recomputeDerivedFields} from './templatedFields';
import {recomputeComputedFields} from './computedFields';

// Site parents Feature via a Child-relation Related Records field.
const makeSpec = (): UiSpecModel => {
  const spec: any = {
    viewsets: {
      Site: {views: ['Site-view'], label: 'Site'},
      Feature: {views: ['Feature-view'], label: 'Feature'},
    },
    views: {
      'Site-view': {
        fields: ['Site-Name', 'Site-Area', 'Site-HRID', 'Site-Features'],
        label: 'Site',
      },
      'Feature-view': {
        fields: [
          'Feature-Note',
          'Feature-Count',
          'Feature-Label',
          'Feature-Density',
        ],
        label: 'Feature',
      },
    },
    fields: {
      'Site-Name': field('faims-core::String'),
      'Site-Area': field('faims-core::Number'),
      // A derived field on the parent - deliberately referenceable.
      'Site-HRID': field('faims-core::String', 'TemplatedStringField'),
      'Site-Features': {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        'component-parameters': {
          related_type: 'Feature',
          relation_type: 'faims-core::Child',
        },
      },
      'Feature-Note': field('faims-core::String'),
      'Feature-Count': field('faims-core::Number'),
      'Feature-Label': {
        ...field('faims-core::String', 'TemplatedStringField'),
        'component-parameters': {
          template: '{{_PARENT.Site-Name}} / {{Feature-Note}}',
        },
      },
      'Feature-Density': {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {
          expression: '{Feature-Count} / {_PARENT.Site-Area}',
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

describe('templated strings with parent references', () => {
  it('renders parent values via {{_PARENT.Field-ID}}', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Feature-Note': 'B2'},
      uiSpecification: makeSpec(),
      formId: 'Feature',
      context: {parentValues: {'Site-Name': 'Alpha'}},
    });
    expect(updates['Feature-Label']).toBe('Alpha / B2');
  });

  it('renders empty for parent references with no parent', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Feature-Note': 'B2'},
      uiSpecification: makeSpec(),
      formId: 'Feature',
      context: {},
    });
    expect(updates['Feature-Label']).toBe(' / B2');
  });

  it('can reference a derived field on the parent', () => {
    const spec = makeSpec();
    (spec.fields['Feature-Label']['component-parameters'] as any).template =
      '{{_PARENT.Site-HRID}}-x';
    compileUiSpecConditionals(spec);
    const {updates} = recomputeDerivedFields({
      values: {},
      uiSpecification: spec,
      formId: 'Feature',
      context: {parentValues: {'Site-HRID': 'SITE-001'}},
    });
    expect(updates['Feature-Label']).toBe('SITE-001-x');
  });
});

describe('computed fields with parent references', () => {
  it('resolves parent values into the expression scope', () => {
    const {updates} = recomputeComputedFields({
      values: {'Feature-Count': 30},
      uiSpecification: makeSpec(),
      formId: 'Feature',
      context: {parentValues: {'Site-Area': 10}},
    });
    expect(updates['Feature-Density']).toBe(3);
  });

  it('coerces parent number values arriving as strings', () => {
    const {updates} = recomputeComputedFields({
      values: {'Feature-Count': 30},
      uiSpecification: makeSpec(),
      formId: 'Feature',
      context: {parentValues: {'Site-Area': '10'}},
    });
    expect(updates['Feature-Density']).toBe(3);
  });

  it('yields blank when the parent value is missing', () => {
    const {updates, changes} = recomputeComputedFields({
      values: {'Feature-Count': 30, 'Feature-Density': 3},
      uiSpecification: makeSpec(),
      formId: 'Feature',
      context: {},
    });
    // Previously computed value clears to null when the parent is gone.
    expect(changes).toBe(true);
    expect(updates['Feature-Density']).toBeNull();
  });

  it('yields blank with no context at all', () => {
    const {updates} = recomputeComputedFields({
      values: {'Feature-Count': 30},
      uiSpecification: makeSpec(),
      formId: 'Feature',
    });
    expect(updates['Feature-Density'] ?? null).toBeNull();
  });
});
