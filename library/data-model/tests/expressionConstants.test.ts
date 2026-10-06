// SPDX-License-Identifier: Apache-2.0
import {
  compileComputedExpressionForForm,
  compileUiSpecConditionals,
  CONSTANT_REFERENCE_PREFIX,
  decodeConstantRef,
  encodeConstantRef,
  EXPRESSION_CONSTANTS,
  ExpressionError,
  isConstantRef,
  isRelatedRef,
  recomputeComputedFields,
  resolveRefType,
  UiSpecModel,
} from '../src';

// A single form computing a circle's area from a radius field.
const makeSpec = (): UiSpecModel => {
  const spec: any = {
    viewsets: {Sample: {views: ['Sample-view'], label: 'Sample'}},
    views: {'Sample-view': {fields: ['Radius', 'Area'], label: 'Sample'}},
    fields: {
      Radius: field('faims-core::Number', 'NumberField'),
      Area: {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {expression: '{_CONSTANT.PI} * {Radius} ^ 2'},
      },
    },
  };
  compileUiSpecConditionals(spec);
  return spec as UiSpecModel;
};

function field(typeReturned: string, componentName: string) {
  return {
    'component-namespace': 'faims-custom',
    'component-name': componentName,
    'type-returned': typeReturned,
    'component-parameters': {},
  };
}

describe('constant reference encoding', () => {
  it('round-trips a name through encode and decode', () => {
    expect(encodeConstantRef('PI')).toBe('_CONSTANT.PI');
    expect(decodeConstantRef('_CONSTANT.PI')).toBe('PI');
  });

  it('rejects non-constant and bare-prefix references', () => {
    expect(decodeConstantRef('PI')).toBeNull();
    expect(decodeConstantRef('_METADATA.PI')).toBeNull();
    expect(decodeConstantRef(CONSTANT_REFERENCE_PREFIX)).toBeNull();
  });

  it('classifies constant references distinctly from related ones', () => {
    expect(isConstantRef('_CONSTANT.PI')).toBe(true);
    expect(isRelatedRef('_CONSTANT.PI')).toBe(false);
    expect(resolveRefType('_CONSTANT.PI')).toBe('CONSTANT');
  });

  it('mirrors the JavaScript Math constants', () => {
    for (const name of [
      'E',
      'LN2',
      'LN10',
      'LOG2E',
      'LOG10E',
      'PI',
      'SQRT1_2',
      'SQRT2',
    ]) {
      expect(EXPRESSION_CONSTANTS.get(name)).toBe(
        (Math as unknown as Record<string, number>)[name]
      );
    }
  });
});

describe('compileComputedExpressionForForm with constants', () => {
  it('compiles a constant without reading it as a linked record field', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{_CONSTANT.PI} * {Radius} ^ 2',
      uiSpecification: makeSpec(),
      formId: 'Sample',
      requiredType: 'number',
    });
    expect(compiled.references).toEqual(['Radius']);
  });

  it('rejects a field ID using the reserved prefix', () => {
    const spec = makeSpec();
    (spec.fields as any)['_CONSTANT.Radius'] = field(
      'faims-core::Number',
      'NumberField'
    );
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Radius}',
        uiSpecification: spec,
        formId: 'Sample',
      })
    ).toThrow(ExpressionError);
  });
});

describe('computed fields with constants', () => {
  it('evaluates using the constant value', () => {
    const {updates} = recomputeComputedFields({
      values: {Radius: 2},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {},
    });
    expect(updates['Area']).toBeCloseTo(Math.PI * 4);
  });
});
