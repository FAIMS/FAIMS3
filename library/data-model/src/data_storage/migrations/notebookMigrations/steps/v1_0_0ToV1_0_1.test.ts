// SPDX-License-Identifier: Apache-2.0

import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../registry';
import {
  findNotebookSchemaMigration,
  runNotebookSchemaMigrationForTest,
  type NotebookSchemaMigrationTestCase,
} from '../testHarness';
import {migrateNotebook} from '../runner';
import {sampleNotebook} from '../test-notebook-V1';
import {NOTEBOOK_SCHEMA_LEGACY} from '../types';
import {V1_0_0_TO_V1_0_1_TARGET} from './v1_0_0ToV1_0_1';

function v100Notebook(fields: Record<string, unknown>) {
  const fieldNames = Object.keys(fields);
  return {
    uiSpec: {
      fields,
      views: {'section-1': {fields: fieldNames, label: 'Section 1'}},
      viewsets: {'form-1': {views: ['section-1'], label: 'Form 1'}},
      visible_types: ['form-1'],
      settings: {showQrCodeButton: false},
      schemaVersion: '1.0.0',
    },
    metadata: {
      information: {
        notebookVersion: '1.0',
        purposeMarkdown: '',
        projectLeadLabel: '',
        leadInstitution: '',
      },
    },
  };
}

const textField = (name: string) => ({
  'component-namespace': 'faims-custom',
  'component-name': 'TextField',
  'type-returned': 'faims-core::String',
  'component-parameters': {name, label: name},
  initialValue: '',
});

const cases: NotebookSchemaMigrationTestCase[] = [
  {
    name: 'stamps exportName from the fields key when missing',
    from: '1.0.0',
    to: V1_0_0_TO_V1_0_1_TARGET,
    input: v100Notebook({
      'Site-Name': textField('Site-Name'),
      Notes: textField('Notes'),
    }),
    assert: output => {
      expect(output.uiSpec.schemaVersion).toBe('1.0.1');
      expect(output.uiSpec.fields['Site-Name'].exportName).toBe('Site-Name');
      expect(output.uiSpec.fields.Notes.exportName).toBe('Notes');
    },
  },
  {
    name: 'keeps an existing non-blank exportName',
    from: '1.0.0',
    to: V1_0_0_TO_V1_0_1_TARGET,
    input: v100Notebook({
      f_abc123: {
        ...textField('f_abc123'),
        exportName: 'Observation-Notes',
      },
    }),
    assert: output => {
      expect(output.uiSpec.fields.f_abc123.exportName).toBe(
        'Observation-Notes'
      );
    },
  },
  {
    name: 'replaces a blank exportName with the fields key',
    from: '1.0.0',
    to: V1_0_0_TO_V1_0_1_TARGET,
    input: v100Notebook({
      'Site-Name': {...textField('Site-Name'), exportName: '   '},
    }),
    assert: output => {
      expect(output.uiSpec.fields['Site-Name'].exportName).toBe('Site-Name');
    },
  },
];

describe('1.0.0 → 1.0.1 exportName stamp', () => {
  const step = findNotebookSchemaMigration('1.0.0', V1_0_0_TO_V1_0_1_TARGET);

  it.each(cases)('$name', ({input, assert}) => {
    const output = runNotebookSchemaMigrationForTest(step, input);
    assert(output);
  });

  it('does not mutate the input', () => {
    const input = v100Notebook({Notes: textField('Notes')});
    const snapshot = structuredClone(input);
    runNotebookSchemaMigrationForTest(step, input);
    expect(input).toEqual(snapshot);
  });
});

describe('legacy notebooks reach 1.0.1', () => {
  it('collapses a schema 1.0 notebook through both hops', () => {
    const {changed, migrated, applied} = migrateNotebook(sampleNotebook);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(applied.map(a => `${a.from}→${a.to}`)).toEqual([
      `${NOTEBOOK_SCHEMA_LEGACY}→1.0.0`,
      '1.0.0→1.0.1',
    ]);
    for (const [id, field] of Object.entries(migrated.uiSpec.fields)) {
      expect(field.exportName.length).toBeGreaterThan(0);
      expect(typeof field.exportName).toBe('string');
      expect(field.exportName).toBe(id);
    }
  });
});
