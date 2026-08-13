import {
  buildParentFieldTypes,
  compileComputedExpressionForForm,
  ExpressionError,
  getParentFormsForForm,
  UiSpecModel,
} from '../src';

// Minimal spec builder: forms with fields, plus Child-relation links.
const makeField = (typeReturned: string, componentName = 'TextField') => ({
  'component-namespace': 'faims-custom',
  'component-name': componentName,
  'type-returned': typeReturned,
  'component-parameters': {},
});

const makeChildLink = (
  targetFormId: string,
  relation = 'faims-core::Child'
) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'RelatedRecordSelector',
  'type-returned': 'faims-core::Relationship',
  'component-parameters': {
    related_type: targetFormId,
    relation_type: relation,
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

describe('getParentFormsForForm', () => {
  it('finds a form holding a Child-relation link to the target', () => {
    const spec = makeSpec({
      Site: {
        'Site-Name': makeField('faims-core::String'),
        'Site-Features': makeChildLink('Feature'),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    expect(
      getParentFormsForForm({uiSpecification: spec, formId: 'Feature'})
    ).toEqual(['Site']);
  });

  it('ignores non-Child relations and unrelated forms', () => {
    const spec = makeSpec({
      Site: {'Site-Linked': makeChildLink('Feature', 'faims-core::Linked')},
      Other: {'Other-Name': makeField('faims-core::String')},
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    expect(
      getParentFormsForForm({uiSpecification: spec, formId: 'Feature'})
    ).toEqual([]);
  });

  it('finds multiple parent forms', () => {
    const spec = makeSpec({
      Site: {'Site-Features': makeChildLink('Feature')},
      Trench: {'Trench-Features': makeChildLink('Feature')},
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    expect(
      getParentFormsForForm({uiSpecification: spec, formId: 'Feature'}).sort()
    ).toEqual(['Site', 'Trench']);
  });
});

describe('buildParentFieldTypes', () => {
  it('types all mapped fields from a single parent', () => {
    const spec = makeSpec({
      Site: {
        'Site-Name': makeField('faims-core::String'),
        'Site-Area': makeField('faims-core::Number'),
        'Site-Geom': makeField('faims-core::JSON'),
        'Site-Features': makeChildLink('Feature'),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    const {types, ambiguous} = buildParentFieldTypes({
      uiSpecification: spec,
      formId: 'Feature',
    });
    expect(types.get('_PARENT.Site-Name')).toBe('string');
    expect(types.get('_PARENT.Site-Area')).toBe('number');
    // Unmapped type on a single parent: not referenceable, not ambiguous.
    expect(types.has('_PARENT.Site-Geom')).toBe(false);
    expect(ambiguous.size).toBe(0);
  });

  it('includes a shared field when both parents agree on type', () => {
    const spec = makeSpec({
      Site: {
        Label: makeField('faims-core::String'),
        'Site-Features': makeChildLink('Feature'),
      },
      Trench: {
        // Same field ID appearing in a second form's view.
        'Trench-Features': makeChildLink('Feature'),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    // Share the Label field between both parents' views.
    (spec as any).views['Trench-view'].fields.push('Label');
    const {types, ambiguous} = buildParentFieldTypes({
      uiSpecification: spec,
      formId: 'Feature',
    });
    expect(types.get('_PARENT.Label')).toBe('string');
    expect(ambiguous.size).toBe(0);
  });

  it('excludes a shared field when its type is not expression-mappable', () => {
    const spec = makeSpec({
      Site: {
        Geom: makeField('faims-core::JSON'),
        'Site-Features': makeChildLink('Feature'),
      },
      Feature: {'Feature-Note': makeField('faims-core::String')},
    });
    const {types} = buildParentFieldTypes({
      uiSpecification: spec,
      formId: 'Feature',
    });
    expect(types.has('_PARENT.Geom')).toBe(false);
  });
});

describe('compileComputedExpressionForForm', () => {
  const spec = makeSpec({
    Site: {
      'Site-Name': makeField('faims-core::String'),
      'Site-Area': makeField('faims-core::Number'),
      'Site-Features': makeChildLink('Feature'),
    },
    Feature: {
      'Feature-Note': makeField('faims-core::String'),
      'Feature-Count': makeField('faims-core::Number'),
    },
  });

  it('compiles and evaluates a mixed local/parent expression', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{_PARENT.Site-Name} & " / " & {Feature-Note}',
      uiSpecification: spec,
      formId: 'Feature',
      requiredType: 'string',
    });
    expect(compiled.references.sort()).toEqual([
      'Feature-Note',
      '_PARENT.Site-Name',
    ]);
    const scope = new Map<string, any>([
      ['_PARENT.Site-Name', 'Alpha'],
      ['Feature-Note', 'B2'],
    ]);
    expect(compiled.evaluate(scope)).toBe('Alpha / B2');
  });

  it('types parent numeric fields for arithmetic', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{_PARENT.Site-Area} * {Feature-Count}',
      uiSpecification: spec,
      formId: 'Feature',
      requiredType: 'number',
    });
    const scope = new Map<string, any>([
      ['_PARENT.Site-Area', 10],
      ['Feature-Count', 3],
    ]);
    expect(compiled.evaluate(scope)).toBe(30);
  });

  it('rejects a parent reference when no parent form exists', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{_PARENT.Anything}',
        uiSpecification: spec,
        formId: 'Site',
      })
    ).toThrow(/no parent form/);
  });

  it('rejects a parent reference to a field on no parent form', () => {
    expect(() =>
      compileComputedExpressionForForm({
        source: '{_PARENT.Missing-Field}',
        uiSpecification: spec,
        formId: 'Feature',
      })
    ).toThrow(/not found on any parent form/);
  });

  it('rejects a local field ID using the reserved prefix', () => {
    const bad = makeSpec({
      Feature: {'_PARENT.x': makeField('faims-core::String')},
    });
    expect(() =>
      compileComputedExpressionForForm({
        source: '{_PARENT.x}',
        uiSpecification: bad,
        formId: 'Feature',
      })
    ).toThrow(ExpressionError);
  });

  it('leaves expressions without parent references unchanged', () => {
    const compiled = compileComputedExpressionForForm({
      source: '{Feature-Count} * 2',
      uiSpecification: spec,
      formId: 'Feature',
      requiredType: 'number',
    });
    expect(compiled.references).toEqual(['Feature-Count']);
  });
});
