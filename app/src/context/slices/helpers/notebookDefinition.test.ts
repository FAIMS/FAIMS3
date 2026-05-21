import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {compileUiSpecConditionals} from '@faims3/data-model';
import {
  dataEngineUiSpecFromCompiled,
  notebookDefinitionFromLegacyPersistedProject,
  projectUiModelFromUiDefinition,
} from './notebookDefinition';

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

describe('projectUiModelFromUiDefinition', () => {
  it('strips settings and schemaVersion from uiSpec', () => {
    const def = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
    });
    const model = projectUiModelFromUiDefinition(def);
    expect(model).not.toHaveProperty('settings');
    expect(model).not.toHaveProperty('schemaVersion');
    expect(model.views).toBeDefined();
  });
});

describe('dataEngineUiSpecFromCompiled', () => {
  it('merges compiled conditionFns with persisted settings', () => {
    const def = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
    });
    const compiled = projectUiModelFromUiDefinition(def);
    compileUiSpecConditionals(compiled);
    const engineSpec = dataEngineUiSpecFromCompiled(compiled, def.uiSpec);
    const fieldNames = Object.keys(engineSpec.fields);
    if (fieldNames.length > 0) {
      const first = engineSpec.fields[fieldNames[0]];
      expect(typeof first.conditionFn).toBe('function');
    }
    expect(engineSpec.settings).toEqual(def.uiSpec.settings);
    expect(engineSpec.schemaVersion).toBe(def.uiSpec.schemaVersion);
  });
});
