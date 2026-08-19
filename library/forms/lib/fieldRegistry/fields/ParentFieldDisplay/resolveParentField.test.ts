import type {DataEngine, UiSpecModel} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {formatFieldValue, resolveParentFieldValue} from './resolveParentField';

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

const textField = (label: string, name: string) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'TextField',
  'type-returned': 'faims-core::String',
  'component-parameters': {label, name, required: false},
  validationSchema: [['yup.string']],
  initialValue: '',
  meta,
  condition: null,
  persistent: false,
});

// Site and Other both parent Feature; Site-Name lives on Site only.
function makeUiSpec(): UiSpecModel {
  return {
    fields: {
      'Site-Name': textField('Site Name', 'site-name'),
      'Other-Field': textField('Other Field', 'other-field'),
      Comments: textField('Comments', 'comments'),
    },
    views: {
      'SITE-v1': {label: 'Site', fields: ['Site-Name']},
      'OTHER-v1': {label: 'Other', fields: ['Other-Field']},
      'FEATURE-v1': {label: 'Feature', fields: ['Comments']},
    },
    viewsets: {
      SITE: {label: 'Site', views: ['SITE-v1']},
      OTHER: {label: 'Other', views: ['OTHER-v1']},
      FEATURE: {label: 'Feature', views: ['FEATURE-v1']},
    },
    visible_types: ['SITE', 'OTHER', 'FEATURE'],
  } as UiSpecModel;
}

type StubRecord = {
  formId: string;
  data: Record<string, {data: unknown}>;
};

// Engine stub: relationship for the child, form data per parent record id.
function makeEngine({
  parents,
  records,
}: {
  parents: {recordId: string}[] | undefined;
  records?: Record<string, StubRecord>;
}): DataEngine {
  return {
    uiSpec: makeUiSpec(),
    hydrated: {
      getHydratedRecord: async () => ({
        revision: parents ? {relationship: {parent: parents}} : {},
      }),
    },
    form: {
      getExistingFormData: async ({recordId}: {recordId: string}) =>
        records?.[recordId],
    },
  } as unknown as DataEngine;
}

describe('formatFieldValue', () => {
  it('formats primitives, arrays, objects and empties', () => {
    expect(formatFieldValue('Alpha')).toBe('Alpha');
    expect(formatFieldValue(42)).toBe('42');
    expect(formatFieldValue(true)).toBe('Yes');
    expect(formatFieldValue(false)).toBe('No');
    expect(formatFieldValue(['a', 'b'])).toBe('a, b');
    expect(formatFieldValue({x: 1})).toBe('{"x":1}');
    expect(formatFieldValue(null)).toBe('');
    expect(formatFieldValue(undefined)).toBe('');
    expect(formatFieldValue('')).toBe('');
  });
});

describe('resolveParentFieldValue', () => {
  it('resolves the value from the parent record', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'site-1'}],
      records: {
        'site-1': {formId: 'SITE', data: {'Site-Name': {data: 'Alpha'}}},
      },
    });
    const result = await resolveParentFieldValue({
      engine,
      recordId: 'feature-1',
      parentFieldId: 'Site-Name',
    });
    expect(result).toEqual({kind: 'value', display: 'Alpha'});
  });

  it('reports no-parent when the record has no parent relationship', async () => {
    for (const parents of [[], undefined]) {
      const engine = makeEngine({parents});
      const result = await resolveParentFieldValue({
        engine,
        recordId: 'feature-1',
        parentFieldId: 'Site-Name',
      });
      expect(result).toEqual({kind: 'no-parent'});
    }
  });

  it('reports field-not-found for a field on no form', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'site-1'}],
      records: {
        'site-1': {formId: 'SITE', data: {'Site-Name': {data: 'Alpha'}}},
      },
    });
    const result = await resolveParentFieldValue({
      engine,
      recordId: 'feature-1',
      parentFieldId: 'Deleted-Field',
    });
    expect(result).toEqual({kind: 'field-not-found'});
  });

  it('skips parents of other forms and resolves from the matching one', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'other-1'}, {recordId: 'site-1'}],
      records: {
        'other-1': {formId: 'OTHER', data: {'Other-Field': {data: 'X'}}},
        'site-1': {formId: 'SITE', data: {'Site-Name': {data: 'Beta'}}},
      },
    });
    const result = await resolveParentFieldValue({
      engine,
      recordId: 'feature-1',
      parentFieldId: 'Site-Name',
    });
    expect(result).toEqual({kind: 'value', display: 'Beta'});
  });

  it('reports field-not-found when no parent is of the right form', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'other-1'}],
      records: {
        'other-1': {formId: 'OTHER', data: {'Other-Field': {data: 'X'}}},
      },
    });
    const result = await resolveParentFieldValue({
      engine,
      recordId: 'feature-1',
      parentFieldId: 'Site-Name',
    });
    expect(result).toEqual({kind: 'field-not-found'});
  });

  it('formats a missing parent value as an empty display', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'site-1'}],
      records: {'site-1': {formId: 'SITE', data: {}}},
    });
    const result = await resolveParentFieldValue({
      engine,
      recordId: 'feature-1',
      parentFieldId: 'Site-Name',
    });
    expect(result).toEqual({kind: 'value', display: ''});
  });
});
