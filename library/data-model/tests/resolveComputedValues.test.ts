// SPDX-License-Identifier: Apache-2.0
import {compileUiSpecConditionals} from '@faims3/data-model';
import {
  applyComputedValues,
  DerivedReadEngine,
  resolveComputedValues,
} from '../src';

function field(typeReturned: string, componentName = 'TextField') {
  return {
    'component-namespace': 'faims-custom',
    'component-name': componentName,
    'type-returned': typeReturned,
    'component-parameters': {},
  };
}

// Site parents Feature via a Child-relation Related Records field.
const makeSpec = (siteArea: object = field('faims-core::Number')) => {
  const spec: any = {
    viewsets: {
      Site: {views: ['Site-view'], label: 'Site'},
      Feature: {views: ['Feature-view'], label: 'Feature'},
    },
    views: {
      'Site-view': {fields: ['Site-Area', 'Site-Features'], label: 'Site'},
      'Feature-view': {
        fields: ['Feature-Count', 'Feature-Density', 'Feature-Season'],
        label: 'Feature',
      },
    },
    fields: {
      'Site-Area': siteArea,
      'Site-Features': {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        'component-parameters': {
          related_type: 'Feature',
          relation_type: 'faims-core::Child',
        },
      },
      'Feature-Count': field('faims-core::Number'),
      'Feature-Density': {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {
          expression: '{Feature-Count} / {_PARENT.Site-Area}',
        },
      },
      'Feature-Season': {
        ...field('faims-core::String', 'ComputedText'),
        'component-parameters': {expression: '{_METADATA.season}'},
      },
    },
  };
  compileUiSpecConditionals(spec);
  return spec;
};

// Test links one Calibration record via a single-link Linked field.
const makeLinkSpec = () => {
  const spec: any = {
    viewsets: {
      Calibration: {views: ['Calibration-view'], label: 'Calibration'},
      Test: {views: ['Test-view'], label: 'Test'},
    },
    views: {
      'Calibration-view': {fields: ['Cutter-Mass-g'], label: 'Calibration'},
      'Test-view': {
        fields: ['Wet-Mass-g', 'Core-Calibration', 'Soil-Mass-g'],
        label: 'Test',
      },
    },
    fields: {
      'Cutter-Mass-g': field('faims-core::Number'),
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
      'Soil-Mass-g': {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {
          expression: '{Wet-Mass-g} - {Core-Calibration.Cutter-Mass-g}',
        },
      },
    },
  };
  compileUiSpecConditionals(spec);
  return spec;
};

const makeEngine = (
  spec: any = makeSpec(),
  fullRead: {
    formId: string;
    data: Record<string, {data: unknown}>;
    context?: {revision: {deleted?: boolean}};
  } = {
    formId: 'Site',
    data: {'Site-Area': {data: 10}},
  }
) => ({
  uiSpec: spec,
  core: {
    getRecord: jest.fn(async () => ({type: 'Site', heads: ['site-rev']})),
    getRevision: jest.fn(async (): Promise<{deleted?: boolean}> => ({})),
  },
  hydrated: {
    getHydratedRecord: jest.fn(),
    getFieldValues: jest.fn(async () => ({'Site-Area': 10})),
  },
  form: {
    getExistingFormData: jest.fn(async () => fullRead),
  },
});

const asEngine = (engine: ReturnType<typeof makeEngine>) =>
  engine as unknown as DerivedReadEngine;

const resolve = (
  engine: ReturnType<typeof makeEngine>,
  args: Partial<Parameters<typeof resolveComputedValues>[0]> = {}
) =>
  resolveComputedValues({
    engine: asEngine(engine),
    recordId: 'feature-1',
    formId: 'Feature',
    values: {'Feature-Count': 30, 'Feature-Density': 1},
    parents: [{recordId: 'site-1'}],
    ...args,
  });

describe('resolveComputedValues with a parent', () => {
  it('recomputes a stale value from the parent', async () => {
    const engine = makeEngine();
    expect(await resolve(engine)).toEqual({'Feature-Density': 3});
    // Parent links were supplied, so the record itself is not re-read.
    expect(engine.hydrated.getHydratedRecord).not.toHaveBeenCalled();
  });

  it('returns nothing when the stored value is current', async () => {
    const values = {'Feature-Count': 30, 'Feature-Density': 3};
    expect(await resolve(makeEngine(), {values})).toEqual({});
  });

  it('keeps the stored value when the record has no parent', async () => {
    expect(await resolve(makeEngine(), {parents: []})).toEqual({});
  });

  it('keeps the stored value when the parent cannot be read', async () => {
    const engine = makeEngine();
    engine.core.getRecord.mockRejectedValue(new Error('not synced'));
    expect(await resolve(engine)).toEqual({});
  });

  it('reads nothing for a form with no computed fields', async () => {
    const engine = makeEngine();
    expect(await resolve(engine, {formId: 'Site', values: {}})).toEqual({});
    expect(engine.core.getRecord).not.toHaveBeenCalled();
    expect(engine.form.getExistingFormData).not.toHaveBeenCalled();
  });

  it('takes the resolving read when the parent field is computed', async () => {
    const engine = makeEngine(
      makeSpec({
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {expression: '5 + 5'},
      })
    );
    expect(await resolve(engine)).toEqual({'Feature-Density': 3});
    expect(engine.hydrated.getFieldValues).not.toHaveBeenCalled();
    expect(engine.form.getExistingFormData).toHaveBeenCalledWith({
      recordId: 'site-1',
      derivedDepth: 1,
    });
  });

  it('resolves _METADATA fields only when metadata is supplied', async () => {
    const values = {
      'Feature-Count': 30,
      'Feature-Density': 3,
      'Feature-Season': 'old',
    };
    expect(await resolve(makeEngine(), {values})).toEqual({});
    expect(
      await resolve(makeEngine(), {
        values,
        metadataValues: {season: '2026A'},
      })
    ).toEqual({'Feature-Season': '2026A'});
  });
});

describe('resolveComputedValues with a linked record', () => {
  const makeLinkEngine = () =>
    makeEngine(makeLinkSpec(), {
      formId: 'Calibration',
      data: {'Cutter-Mass-g': {data: 40}},
    });
  const linkArgs = {formId: 'Test', recordId: 'test-1', parents: []};
  const linkedValues = {
    'Wet-Mass-g': 100,
    'Core-Calibration': {record_id: 'cal-1'},
    'Soil-Mass-g': 1,
  };

  it('recomputes a stale value from the linked record', async () => {
    const engine = makeLinkEngine();
    expect(await resolve(engine, {...linkArgs, values: linkedValues})).toEqual({
      'Soil-Mass-g': 60,
    });
    expect(engine.form.getExistingFormData).toHaveBeenCalledWith({
      recordId: 'cal-1',
      derivedDepth: 1,
    });
  });

  it('keeps the stored value when the link cannot be read', async () => {
    const engine = makeLinkEngine();
    engine.form.getExistingFormData.mockRejectedValue(new Error('not synced'));
    expect(await resolve(engine, {...linkArgs, values: linkedValues})).toEqual(
      {}
    );
  });

  it('blanks the value when the link is removed', async () => {
    const values = {'Wet-Mass-g': 100, 'Soil-Mass-g': 60};
    expect(await resolve(makeLinkEngine(), {...linkArgs, values})).toEqual({
      'Soil-Mass-g': null,
    });
  });
});

describe('applyComputedValues', () => {
  const record = {
    record_id: 'feature-1',
    type: 'Feature',
    data: {'Feature-Count': 30, 'Feature-Density': 1},
  };

  it('overlays resolved values on the record data', async () => {
    // No parent links supplied, so the record's own are read.
    const engine = makeEngine();
    engine.hydrated.getHydratedRecord.mockResolvedValue({
      revision: {relationship: {parent: [{recordId: 'site-1'}]}},
    });
    const resolved = await applyComputedValues({
      engine: asEngine(engine),
      record,
    });
    expect(resolved.data).toEqual({'Feature-Count': 30, 'Feature-Density': 3});
    expect(record.data['Feature-Density']).toBe(1);
  });

  it('returns the same record when nothing changed', async () => {
    const site = {record_id: 'site-1', type: 'Site', data: {'Site-Area': 10}};
    expect(
      await applyComputedValues({engine: asEngine(makeEngine()), record: site})
    ).toBe(site);
  });
});

describe('resolveComputedValues with a deleted record', () => {
  it('blanks the value when the parent is deleted', async () => {
    const engine = makeEngine();
    engine.core.getRevision.mockResolvedValue({deleted: true});
    expect(await resolve(engine)).toEqual({'Feature-Density': null});
  });

  it('blanks the value when the linked record is deleted', async () => {
    const engine = makeEngine(makeLinkSpec(), {
      formId: 'Calibration',
      data: {'Cutter-Mass-g': {data: 40}},
      context: {revision: {deleted: true}},
    });
    expect(
      await resolve(engine, {
        formId: 'Test',
        recordId: 'test-1',
        parents: [],
        values: {
          'Wet-Mass-g': 100,
          'Core-Calibration': {record_id: 'cal-1'},
          'Soil-Mass-g': 60,
        },
      })
    ).toEqual({'Soil-Mass-g': null});
  });
});
