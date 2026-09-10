import {buildCompiledSpecId} from './databaseHelpers';

// Minimal spec-shaped objects; the builder hashes whatever it's given.
const id = {serverId: 'server-1', projectId: 'proj-1'};

const specA = {
  fields: {
    'Field-A': {label: 'A', order: 1},
    'Field-B': {label: 'B', order: 2},
  },
  views: {'view-1': {fields: ['Field-A', 'Field-B']}},
  viewsets: {form: {views: ['view-1']}},
} as any;

// Same content, different key ordering at both depths.
const specAReordered = {
  viewsets: {form: {views: ['view-1']}},
  views: {'view-1': {fields: ['Field-A', 'Field-B']}},
  fields: {
    'Field-B': {order: 2, label: 'B'},
    'Field-A': {order: 1, label: 'A'},
  },
} as any;

describe('buildCompiledSpecId', () => {
  it('produces identical IDs for identical specs', () => {
    expect(buildCompiledSpecId({id, uiSpec: specA})).toBe(
      buildCompiledSpecId({id, uiSpec: specA})
    );
  });

  it('ignores object key ordering at any depth', () => {
    expect(buildCompiledSpecId({id, uiSpec: specAReordered})).toBe(
      buildCompiledSpecId({id, uiSpec: specA})
    );
  });

  it('changes when any value changes', () => {
    const changed = JSON.parse(JSON.stringify(specA));
    changed.fields['Field-A'].label = 'A2';
    expect(buildCompiledSpecId({id, uiSpec: changed})).not.toBe(
      buildCompiledSpecId({id, uiSpec: specA})
    );
  });

  it('changes when whitespace inside a value changes', () => {
    // Whitespace in data is data - only structural formatting is irrelevant.
    const changed = JSON.parse(JSON.stringify(specA));
    changed.fields['Field-A'].label = 'A ';
    expect(buildCompiledSpecId({id, uiSpec: changed})).not.toBe(
      buildCompiledSpecId({id, uiSpec: specA})
    );
  });

  it('preserves array order sensitivity', () => {
    // Field order in a view is meaningful, so reordering must change the ID.
    const changed = JSON.parse(JSON.stringify(specA));
    changed.views['view-1'].fields = ['Field-B', 'Field-A'];
    expect(buildCompiledSpecId({id, uiSpec: changed})).not.toBe(
      buildCompiledSpecId({id, uiSpec: specA})
    );
  });

  it('distinguishes null, empty string and absent values', () => {
    const withNull = {...specA, extra: null};
    const withEmpty = {...specA, extra: ''};
    const ids = [
      buildCompiledSpecId({id, uiSpec: specA}),
      buildCompiledSpecId({id, uiSpec: withNull}),
      buildCompiledSpecId({id, uiSpec: withEmpty}),
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it('scopes the ID to server and project', () => {
    expect(
      buildCompiledSpecId({
        id: {serverId: 'server-2', projectId: 'proj-1'},
        uiSpec: specA,
      })
    ).not.toBe(buildCompiledSpecId({id, uiSpec: specA}));
  });
});
