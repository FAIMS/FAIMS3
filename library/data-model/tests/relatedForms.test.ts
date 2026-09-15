import {
  buildRelatedFieldTypes,
  compileComputedExpressionForForm,
  ExpressionError,
  getRelatedRecordFields,
  splitRelatedReference,
  UiSpecModel,
} from '../src';

// Minimal spec builder: forms with fields, plus Related Records links.
const makeField = (typeReturned: string, componentName = 'TextField') => ({
  'component-namespace': 'faims-custom',
  'component-name': componentName,
  'type-returned': typeReturned,
  'component-parameters': {},
});

const makeLink = (
  targetFormId: string,
  {
    multiple,
    relation = 'faims-core::Linked',
  }: {multiple?: boolean; relation?: string} = {}
) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'RelatedRecordSelector',
  'type-returned': 'faims-core::Relationship',
  'component-parameters': {
    related_type: targetFormId,
    relation_type: relation,
    ...(multiple === undefined ? {} : {multiple}),
  },
});

const makeSpec = (forms: {
  [formId: string]: {[fieldId: string]: any};
}): UiSpecModel => {
  const spec: any = {viewsets: {}, views: {}, fields: {}};
  for (const [formId, fields] of Object.entries(forms)) {
    const viewId = `${formId}-view`;
    spec.viewsets[formId] = {views: [viewId], label: formId};
    spec.views[viewId] = {fields: Object.keys(fields), label: formId};
    for (const [fieldId, def] of Object.entries(fields)) {
      spec.fields[fieldId] = def;
    }
  }
  return spec as UiSpecModel;
};

// GroundSight shape: a test form linking one calibration record.
const coreCutterSpec = () =>
  makeSpec({
    Calibration: {
      'Cutter-Mass-g': makeField('faims-core::Number'),
      'Cutter-ID': makeField('faims-core::String'),
      'Cutter-Note': makeField('faims-core::Bool'),
    },
    Test: {
      'Wet-Mass-g': makeField('faims-core::Number'),
      'Core-Calibration': makeLink('Calibration'),
      Photos: makeLink('Photo', {multiple: true}),
    },
    Photo: {'Photo-Caption': makeField('faims-core::String')},
  });

describe('getRelatedRecordFields', () => {
  it('finds single- and multi-link fields with their linked form', () => {
    const fields = getRelatedRecordFields({
      uiSpecification: coreCutterSpec(),
      formId: 'Test',
    });
    expect(fields.get('Core-Calibration')).toEqual({
      relatedFormId: 'Calibration',
      multiple: false,
    });
    expect(fields.get('Photos')).toEqual({
      relatedFormId: 'Photo',
      multiple: true,
    });
    expect(fields.has('Wet-Mass-g')).toBe(false);
  });

  it('ignores Child relations, which are the _PARENT path', () => {
    const spec = makeSpec({
      Site: {
        'Site-Feature': makeLink('Feature', {relation: 'faims-core::Child'}),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    expect(
      getRelatedRecordFields({uiSpecification: spec, formId: 'Site'}).size
    ).toBe(0);
  });

  it('skips a selector whose parameters are malformed', () => {
    const spec = makeSpec({
      Test: {
        Broken: {
          'component-namespace': 'faims-custom',
          'component-name': 'RelatedRecordSelector',
          'type-returned': 'faims-core::Relationship',
          'component-parameters': {relation_type: 'faims-core::Linked'},
        },
      },
    });
    expect(
      getRelatedRecordFields({uiSpecification: spec, formId: 'Test'}).size
    ).toBe(0);
  });
});

describe('splitRelatedReference', () => {
  it('splits at the first separator only', () => {
    expect(splitRelatedReference('A.B')).toEqual({
      relFieldId: 'A',
      fieldId: 'B',
    });
    expect(splitRelatedReference('A.B.C')).toEqual({
      relFieldId: 'A',
      fieldId: 'B.C',
    });
  });

  it('returns null for plain, leading- or trailing-dot references', () => {
    expect(splitRelatedReference('Wet-Mass-g')).toBeNull();
    expect(splitRelatedReference('.B')).toBeNull();
    expect(splitRelatedReference('A.')).toBeNull();
  });
});

describe('buildRelatedFieldTypes', () => {
  it('types fields on the linked form of each single-link field', () => {
    const {types} = buildRelatedFieldTypes({
      uiSpecification: coreCutterSpec(),
      formId: 'Test',
    });
    expect(types.get('Core-Calibration.Cutter-Mass-g')).toBe('number');
    expect(types.get('Core-Calibration.Cutter-ID')).toBe('string');
    expect(types.get('Core-Calibration.Cutter-Note')).toBe('boolean');
  });

  it('excludes multi-link fields from the type map but reports them', () => {
    const {types, relatedFields} = buildRelatedFieldTypes({
      uiSpecification: coreCutterSpec(),
      formId: 'Test',
    });
    expect(types.has('Photos.Photo-Caption')).toBe(false);
    expect(relatedFields.get('Photos')?.multiple).toBe(true);
  });

  it('is empty for a form with no Related Records fields', () => {
    const {types, relatedFields} = buildRelatedFieldTypes({
      uiSpecification: coreCutterSpec(),
      formId: 'Calibration',
    });
    expect(types.size).toBe(0);
    expect(relatedFields.size).toBe(0);
  });
});

describe('compileComputedExpressionForForm with related references', () => {
  it('compiles a reference through a single-link field', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{Wet-Mass-g} - {Core-Calibration.Cutter-Mass-g}',
      uiSpecification: coreCutterSpec(),
      formId: 'Test',
      requiredType: 'number',
    });
    expect(compiled.references).toContain('Core-Calibration.Cutter-Mass-g');
    expect(compiled.references).toContain('Wet-Mass-g');
  });

  it('type checks the linked field', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Core-Calibration.Cutter-ID} * 2',
        uiSpecification: coreCutterSpec(),
        formId: 'Test',
        requiredType: 'number',
      })
    ).toThrow(ExpressionError);
  });

  it('rejects a reference through a multi-link field', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Photos.Photo-Caption}',
        uiSpecification: coreCutterSpec(),
        formId: 'Test',
      })
    ).toThrow(/allows multiple linked records/);
  });

  it('rejects a reference whose head is not a Linked field', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Wet-Mass-g.Anything}',
        uiSpecification: coreCutterSpec(),
        formId: 'Test',
      })
    ).toThrow(/is not a Linked Related Records field on this form/);
  });

  it('rejects a reference through a Child-relation field', () => {
    const spec = makeSpec({
      Site: {
        'Site-Feature': makeLink('Feature', {relation: 'faims-core::Child'}),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Site-Feature.Feature-Note}',
        uiSpecification: spec,
        formId: 'Site',
      })
    ).toThrow(/is not a Linked Related Records field on this form/);
  });

  it('rejects a field missing from the linked form', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{Core-Calibration.Nope}',
        uiSpecification: coreCutterSpec(),
        formId: 'Test',
      })
    ).toThrow(/was not found on form "Calibration"/);
  });

  it('still reports missing parent references separately', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{_PARENT.Nope}',
        uiSpecification: coreCutterSpec(),
        formId: 'Test',
      })
    ).toThrow(/parent/);
  });
});
