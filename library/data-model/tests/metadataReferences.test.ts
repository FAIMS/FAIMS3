import {compileUiSpecConditionals, UiSpecModel} from '@faims3/data-model';
import {
  buildConditionValues,
  compileComputedExpressionForForm,
  decodeMetadataRef,
  encodeMetadataRef,
  isMetadataRef,
  isRelatedRef,
  METADATA_REFERENCE_PREFIX,
  recomputeComputedFields,
  recomputeDerivedFields,
  resolveRefType,
} from '../src';

// A single form whose templated and computed fields read notebook metadata.
const makeSpec = (): UiSpecModel => {
  const spec: any = {
    viewsets: {
      Sample: {views: ['Sample-view'], label: 'Sample'},
    },
    views: {
      'Sample-view': {
        fields: ['Sample-Name', 'Sample-Label', 'Sample-Code'],
        label: 'Sample',
      },
    },
    fields: {
      'Sample-Name': field('faims-core::String'),
      'Sample-Label': {
        ...field('faims-core::String', 'TemplatedStringField'),
        'component-parameters': {
          template: '{{_METADATA.season}}-{{Sample-Name}}',
        },
      },
      'Sample-Code': {
        ...field('faims-core::String', 'ComputedText'),
        'component-parameters': {
          expression: "{_METADATA.season} & '/' & {Sample-Name}",
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

describe('metadata reference encoding', () => {
  it('round-trips a key through encode and decode', () => {
    expect(encodeMetadataRef('season')).toBe('_METADATA.season');
    expect(decodeMetadataRef('_METADATA.season')).toBe('season');
  });

  it('rejects non-metadata and bare-prefix references', () => {
    expect(decodeMetadataRef('season')).toBeNull();
    expect(decodeMetadataRef('_PARENT.season')).toBeNull();
    expect(decodeMetadataRef(METADATA_REFERENCE_PREFIX)).toBeNull();
  });

  it('classifies metadata references distinctly from related ones', () => {
    expect(isMetadataRef('_METADATA.season')).toBe(true);
    expect(isRelatedRef('_METADATA.season')).toBe(false);
    expect(resolveRefType('_METADATA.season')).toBe('METADATA');
    expect(resolveRefType('Link-Field.season')).toBe('RELATED_FIELD');
    expect(resolveRefType('season')).toBe('FIELD');
  });
});

describe('templated strings with metadata references', () => {
  it('renders metadata values via {{_METADATA.key}}', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Sample-Name': 'S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {metadataValues: {season: '2026A'}},
    });
    expect(updates['Sample-Label']).toBe('2026A-S1');
  });

  it('renders empty for a key the notebook does not define', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Sample-Name': 'S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {metadataValues: {other: 'x'}},
    });
    expect(updates['Sample-Label']).toBe('-S1');
  });

  it('renders empty with no metadata in context', () => {
    const {updates} = recomputeDerivedFields({
      values: {'Sample-Name': 'S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {},
    });
    expect(updates['Sample-Label']).toBe('-S1');
  });
});

describe('computed fields with metadata references', () => {
  it('resolves metadata values into the expression scope', () => {
    const {updates} = recomputeComputedFields({
      values: {'Sample-Name': 'S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {metadataValues: {season: '2026A'}},
    });
    expect(updates['Sample-Code']).toBe('2026A/S1');
  });

  it('yields blank when the key is missing', () => {
    const {updates, changes} = recomputeComputedFields({
      values: {'Sample-Name': 'S1', 'Sample-Code': '2026A/S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {metadataValues: {}},
    });
    expect(changes).toBe(true);
    expect(updates['Sample-Code']).toBeNull();
  });

  it('yields blank when the value is empty', () => {
    const {updates, changes} = recomputeComputedFields({
      values: {'Sample-Name': 'S1', 'Sample-Code': '2026A/S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
      context: {metadataValues: {season: ''}},
    });
    expect(changes).toBe(true);
    expect(updates['Sample-Code']).toBeNull();
  });

  it('yields blank with no context at all', () => {
    const {updates, changes} = recomputeComputedFields({
      values: {'Sample-Name': 'S1', 'Sample-Code': '2026A/S1'},
      uiSpecification: makeSpec(),
      formId: 'Sample',
    });
    expect(changes).toBe(true);
    expect(updates['Sample-Code']).toBeNull();
  });
});

describe('conditions with metadata references', () => {
  it('merges metadata values under _METADATA keys', () => {
    const result = buildConditionValues({
      values: {'Field-A': 1},
      context: {metadataValues: {season: '2026A', tests: 'core, shear'}},
    });
    expect(result).toEqual({
      'Field-A': 1,
      [encodeMetadataRef('season')]: '2026A',
      [encodeMetadataRef('tests')]: 'core, shear',
    });
  });

  it('leaves values untouched without metadata', () => {
    const values = {'Field-A': 1};
    expect(buildConditionValues({values, context: {}})).toEqual(values);
  });
});

describe('compiling expressions with metadata references', () => {
  it('types any metadata reference as string', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{_METADATA.anything}',
      uiSpecification: makeSpec(),
      formId: 'Sample',
    });
    expect(compiled.returnType).toBe('string');
    expect(compiled.references).toEqual(['_METADATA.anything']);
  });

  it('rejects a bare metadata prefix', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{_METADATA.}',
        uiSpecification: makeSpec(),
        formId: 'Sample',
      })
    ).toThrow(/needs a key/);
  });

  it('rejects a field ID using the reserved prefix', () => {
    const spec = makeSpec();
    (spec.fields as any)['_METADATA.shadow'] = field('faims-core::String');
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Sample-Name}',
        uiSpecification: spec,
        formId: 'Sample',
      })
    ).toThrow(/reserved prefix/);
  });
});
