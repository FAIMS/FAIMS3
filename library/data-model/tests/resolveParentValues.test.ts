import type {DataEngine, UiSpecModel} from '@faims3/data-model';
import {resolveParentValues} from '../src';

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

const childLink = (target: string) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'RelatedRecordSelector',
  'type-returned': 'faims-core::Relationship',
  'component-parameters': {
    name: 'site-features',
    label: 'Site Features',
    related_type: target,
    relation_type: 'faims-core::Child',
  },
  validationSchema: [],
  initialValue: null,
  meta,
  condition: null,
  persistent: false,
});

// SITE parents FEATURE via a Child-relation link; OTHER does not.
function makeUiSpec(): UiSpecModel {
  return {
    fields: {
      'Site-Name': textField('Site Name', 'site-name'),
      'Site-Features': childLink('FEATURE'),
      'Other-Field': textField('Other Field', 'other-field'),
      Comments: textField('Comments', 'comments'),
      'Feature-Label': {
        ...textField('Feature Label', 'feature-label'),
        'component-name': 'TemplatedStringField',
        'component-parameters': {
          label: 'Feature Label',
          name: 'feature-label',
          required: false,
          template: '{{_PARENT.Site-Name}}',
        },
      },
    },
    views: {
      'SITE-v1': {label: 'Site', fields: ['Site-Name', 'Site-Features']},
      'OTHER-v1': {label: 'Other', fields: ['Other-Field']},
      'FEATURE-v1': {label: 'Feature', fields: ['Comments', 'Feature-Label']},
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
  heads?: string[];
};

function makeEngine({
  parents,
  records,
  revisionValues,
  failHydration,
}: {
  parents: {recordId: string}[] | undefined;
  records?: Record<string, StubRecord>;
  revisionValues?: Record<string, Record<string, unknown>>;
  failHydration?: boolean;
}): DataEngine {
  return {
    uiSpec: makeUiSpec(),
    core: {
      getRecord: async (recordId: string) => {
        const rec = records?.[recordId];
        if (!rec) throw new Error(`no record ${recordId}`);
        return {type: rec.formId, heads: rec.heads ?? [`frev-${recordId}`]};
      },
    },
    hydrated: {
      getHydratedRecord: async () => {
        if (failHydration) throw new Error('boom');
        return {revision: parents ? {relationship: {parent: parents}} : {}};
      },
      getFieldValues: async ({
        revisionId,
        fields,
      }: {
        revisionId: string;
        fields: string[];
      }) => {
        const all = revisionValues?.[revisionId] ?? {};
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          if (f in all) out[f] = all[f];
        }
        return out;
      },
    },
    form: {
      getExistingFormData: async ({recordId}: {recordId: string}) =>
        records?.[recordId],
    },
  } as unknown as DataEngine;
}

describe('resolveParentValues', () => {
  it('returns unwrapped raw values from the parent', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'rec-site'}],
      records: {
        'rec-site': {
          formId: 'SITE',
          data: {'Site-Name': {data: 'Alpha'}},
        },
      },
      revisionValues: {'frev-rec-site': {'Site-Name': 'Alpha'}},
    });
    const values = await resolveParentValues({
      engine,
      recordId: 'rec-child',
      formId: 'FEATURE',
    });
    expect(values).toEqual({'Site-Name': 'Alpha'});
  });

  it('returns null when the record has no parent', async () => {
    const engine = makeEngine({parents: undefined});
    expect(
      await resolveParentValues({engine, recordId: 'r', formId: 'FEATURE'})
    ).toBeNull();
  });

  it('skips a parent whose form cannot parent this form', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'rec-other'}, {recordId: 'rec-site'}],
      records: {
        'rec-other': {formId: 'OTHER', data: {'Other-Field': {data: 'x'}}},
        'rec-site': {formId: 'SITE', data: {'Site-Name': {data: 'Alpha'}}},
      },
      revisionValues: {'frev-rec-site': {'Site-Name': 'Alpha'}},
    });
    const values = await resolveParentValues({
      engine,
      recordId: 'rec-child',
      formId: 'FEATURE',
    });
    expect(values).toEqual({'Site-Name': 'Alpha'});
  });

  it('returns null when no parent matches a parent form', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'rec-other'}],
      records: {
        'rec-other': {formId: 'OTHER', data: {'Other-Field': {data: 'x'}}},
      },
    });
    expect(
      await resolveParentValues({engine, recordId: 'r', formId: 'FEATURE'})
    ).toBeNull();
  });

  it('returns null on resolution failure', async () => {
    const engine = makeEngine({parents: undefined, failHydration: true});
    expect(
      await resolveParentValues({engine, recordId: 'r', formId: 'FEATURE'})
    ).toBeNull();
  });

  it('fetches only the referenced parent fields', async () => {
    const fetched: string[][] = [];
    const engine = makeEngine({
      parents: [{recordId: 'rec-site'}],
      records: {
        'rec-site': {
          formId: 'SITE',
          data: {
            'Site-Name': {data: 'Alpha'},
            'Site-Features': {data: null},
          },
        },
      },
      revisionValues: {'frev-rec-site': {'Site-Name': 'Alpha'}},
    });
    // Spy on getFieldValues to capture the requested field list.
    const original = engine.hydrated.getFieldValues.bind(engine.hydrated);
    engine.hydrated.getFieldValues = async args => {
      fetched.push(args.fields);
      return original(args);
    };
    const values = await resolveParentValues({
      engine,
      recordId: 'rec-child',
      formId: 'FEATURE',
    });
    expect(values).toEqual({'Site-Name': 'Alpha'});
    expect(fetched).toEqual([['Site-Name']]);
  });

  it('falls back to a full fetch when the parent has conflicting heads', async () => {
    const engine = makeEngine({
      parents: [{recordId: 'rec-site'}],
      records: {
        'rec-site': {
          formId: 'SITE',
          data: {
            'Site-Name': {data: 'Alpha'},
            'Site-Features': {data: 'link'},
          },
          heads: ['frev-a', 'frev-b'],
        },
      },
    });
    const values = await resolveParentValues({
      engine,
      recordId: 'rec-child',
      formId: 'FEATURE',
    });
    // Full unwrapped data, via getExistingFormData.
    expect(values).toEqual({'Site-Name': 'Alpha', 'Site-Features': 'link'});
  });
});
