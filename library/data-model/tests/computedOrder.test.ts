// SPDX-License-Identifier: Apache-2.0
import {
  compileUiSpecConditionals,
  computedFieldOrder,
  recomputeComputedFields,
  sortByDependencies,
  UiSpecModel,
} from '../src';

const dependencies = (entries: Record<string, string[]>) =>
  new Map(Object.entries(entries));

describe('sortByDependencies', () => {
  it('places a chain from the last dependency up', () => {
    expect(
      sortByDependencies(
        dependencies({Label: ['Volume'], Volume: ['Area'], Area: []})
      )
    ).toEqual({order: ['Area', 'Volume', 'Label'], cycles: []});
  });

  it('places a shared dependency once, before both fields that read it', () => {
    expect(
      sortByDependencies(
        dependencies({
          Combined: ['Density', 'Scaled'],
          Scaled: ['Count'],
          Density: ['Count'],
          Count: [],
        })
      )
    ).toEqual({order: ['Count', 'Density', 'Scaled', 'Combined'], cycles: []});
  });

  it('keeps independent fields in the order given', () => {
    expect(sortByDependencies(dependencies({B: [], A: []}))).toEqual({
      order: ['B', 'A'],
      cycles: [],
    });
  });

  it('reports two fields that read each other', () => {
    expect(sortByDependencies(dependencies({A: ['B'], B: ['A']}))).toEqual({
      order: [],
      cycles: [['A', 'B', 'A']],
    });
  });

  it('reports a field that reads itself', () => {
    expect(sortByDependencies(dependencies({A: ['A']}))).toEqual({
      order: [],
      cycles: [['A', 'A']],
    });
  });

  it('leaves out a field that reads a cycle, and still orders the rest', () => {
    expect(
      sortByDependencies(
        dependencies({Reader: ['A'], A: ['B'], B: ['A'], Free: []})
      )
    ).toEqual({order: ['Free'], cycles: [['A', 'B', 'A']]});
  });
});

function field(typeReturned: string, componentName = 'TextField') {
  return {
    'component-namespace': 'faims-custom',
    'component-name': componentName,
    'type-returned': typeReturned,
    'component-parameters': {},
  };
}

const computedNumber = (expression: string) => ({
  ...field('faims-core::Number', 'ComputedNumber'),
  'component-parameters': {expression},
});

// Listed in the reverse of the order they must be evaluated in.
const plotFields = () => ({
  Label: {
    ...field('faims-core::String', 'ComputedText'),
    'component-parameters': {expression: "{Volume} > 100 ? 'big' : 'small'"},
  },
  Volume: computedNumber('{Area} * {Depth}'),
  Area: computedNumber('{Width} * {Height}'),
  Width: field('faims-core::Number'),
  Height: field('faims-core::Number'),
  Depth: field('faims-core::Number'),
});

const makeSpec = (extraFields: Record<string, object> = {}): UiSpecModel => {
  const fields = {...plotFields(), ...extraFields};
  const spec: any = {
    viewsets: {Plot: {views: ['Plot-view'], label: 'Plot'}},
    views: {'Plot-view': {fields: Object.keys(fields), label: 'Plot'}},
    fields,
  };
  compileUiSpecConditionals(spec);
  return spec as UiSpecModel;
};

const orderOf = (spec: UiSpecModel, fieldId: string) =>
  (spec.fields[fieldId] as {expressionOrder?: number}).expressionOrder;

describe('computedFieldOrder', () => {
  it('orders computed fields by the computed fields they reference', () => {
    const fields = plotFields();
    expect(computedFieldOrder({fields, fieldIds: Object.keys(fields)})).toEqual(
      {order: ['Area', 'Volume', 'Label'], cycles: []}
    );
  });

  it('ignores computed fields outside the form', () => {
    const fields = plotFields();
    expect(computedFieldOrder({fields, fieldIds: ['Label', 'Width']})).toEqual({
      order: ['Label'],
      cycles: [],
    });
  });
});

describe('same-form computed references', () => {
  it('compiles each field with its position in the order', () => {
    const spec = makeSpec();
    expect(orderOf(spec, 'Area')).toBe(0);
    expect(orderOf(spec, 'Volume')).toBe(1);
    expect(orderOf(spec, 'Label')).toBe(2);
  });

  it('evaluates a chain in one pass, whatever the form order', () => {
    const {updates} = recomputeComputedFields({
      values: {Width: 5, Height: 4, Depth: 10},
      uiSpecification: makeSpec(),
      formId: 'Plot',
    });
    expect(updates).toEqual({Area: 20, Volume: 200, Label: 'big'});
  });

  it('blanks every field after a blank input', () => {
    const {updates} = recomputeComputedFields({
      // Height is missing; the stored results are stale
      values: {Width: 5, Depth: 10, Area: 20, Volume: 200, Label: 'big'},
      uiSpecification: makeSpec(),
      formId: 'Plot',
    });
    expect(updates).toEqual({Area: null, Volume: null, Label: null});
  });

  describe('with a reference cycle', () => {
    const makeCyclicSpec = () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const spec = makeSpec({
        'Loop-A': computedNumber('{Loop-B} + 1'),
        'Loop-B': computedNumber('{Loop-A} + 1'),
        'Loop-Reader': computedNumber('{Loop-A} * 2'),
      });
      const warnings = warn.mock.calls.map(call => String(call[0]));
      warn.mockRestore();
      return {spec, warnings};
    };

    it('gives the cycle and its readers no position, and reports it', () => {
      const {spec, warnings} = makeCyclicSpec();
      expect(orderOf(spec, 'Loop-A')).toBeUndefined();
      expect(orderOf(spec, 'Loop-B')).toBeUndefined();
      expect(orderOf(spec, 'Loop-Reader')).toBeUndefined();
      expect(warnings.join('\n')).toContain('Loop-A -> Loop-B -> Loop-A');
    });

    it('leaves those fields blank and still evaluates the rest', () => {
      const {spec} = makeCyclicSpec();
      const {updates} = recomputeComputedFields({
        values: {
          Width: 5,
          Height: 4,
          Depth: 10,
          'Loop-A': 1,
          'Loop-B': 2,
          'Loop-Reader': 3,
        },
        uiSpecification: spec,
        formId: 'Plot',
      });
      expect(updates).toEqual({
        Area: 20,
        Volume: 200,
        Label: 'big',
        'Loop-A': null,
        'Loop-B': null,
        'Loop-Reader': null,
      });
    });
  });
});
