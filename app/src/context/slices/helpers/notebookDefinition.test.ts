import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {notebookDefinitionFromLegacyPersistedProject} from './notebookDefinition';
import {compiledSpecService} from './compiledSpecService';

const legacyNotebookPath = path.join(
  __dirname,
  '../../../../../api/notebooks/sample_notebook.legacy.json'
);
const legacyNotebook = JSON.parse(
  fs.readFileSync(legacyNotebookPath, 'utf-8')
) as {metadata: Record<string, unknown>};

describe('notebookDefinitionFromLegacyPersistedProject', () => {
  it('migrates legacy metadata + encoded wire shape to NotebookDefinition', () => {
    const uiDefinition = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
      rawUiSpecification: undefined,
    });
    expect(uiDefinition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(uiDefinition.metadata.information.purposeMarkdown).toBe(
      legacyNotebook.metadata.pre_description
    );
    expect(uiDefinition.uiSpec).not.toHaveProperty('fviews');
  });

  it('accepts decoded views on rawUiSpecification', () => {
    const migrated = notebookDefinitionFromLegacyPersistedProject({
      metadata: {schema_version: '3.0', pre_description: 'x'},
      rawUiSpecification: {
        fields: {},
        views: {s1: {fields: []}},
        viewsets: {form: {views: ['s1'], label: 'Form'}},
        visible_types: ['form'],
      },
    });
    expect(migrated.uiSpec.views).toHaveProperty('s1');
  });
});

describe('compiledSpecService', () => {
  it('keeps settings and schemaVersion and compiles conditionFns', () => {
    const def = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
    });
    const id = 'test-compiled-spec';
    compiledSpecService.compileAndRegisterSpec(id, def.uiSpec);
    const compiled = compiledSpecService.getSpec(id)!;
    const fieldNames = Object.keys(compiled.fields);
    if (fieldNames.length > 0) {
      const first = compiled.fields[fieldNames[0]];
      expect(typeof first.conditionFn).toBe('function');
    }
    expect(compiled.settings).toEqual(def.uiSpec.settings);
    expect(compiled.schemaVersion).toBe(def.uiSpec.schemaVersion);
    compiledSpecService.removeSpec(id);
  });
});
