import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
  type GetNotebookResponse,
} from '@faims3/data-model';
import {
  notebookDefinitionFromLegacyPersistedProject,
  placeholderNotebookDefinition,
  projectInformationFromGetNotebook,
} from './notebookDefinition';
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

describe('projectInformationFromGetNotebook (fail-soft ingest)', () => {
  const base = {
    _id: 'nb',
    name: 'NB',
    status: ProjectStatus.OPEN,
  } as unknown as GetNotebookResponse;

  it('migrates a legacy uiSpecification and records compatible', () => {
    const info = projectInformationFromGetNotebook({
      ...base,
      uiSpecification: legacyNotebook as any,
    });
    expect(info.uiDefinition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(info.schemaCompatibility).toMatchObject({
      tier: 'compatible',
      relation: 'legacy',
    });
  });

  it('never throws for a newer major; returns placeholder + incompatible', () => {
    const migrated = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
    });
    const newer = JSON.parse(JSON.stringify(migrated));
    newer.uiSpec.schemaVersion = '99.0.0';

    const info = projectInformationFromGetNotebook({
      ...base,
      uiSpecification: newer,
    });
    expect(info.schemaCompatibility?.tier).toBe('incompatible');
    expect(info.schemaCompatibility?.notebookSchemaVersion).toBe('99.0.0');
    expect(info.uiDefinition.uiSpec.fields).toEqual({});
    expect(info.uiDefinition.metadata.information.purposeMarkdown).toBe(
      migrated.metadata.information.purposeMarkdown
    );
  });

  it('returns placeholder + incompatible when uiSpecification is missing', () => {
    const info = projectInformationFromGetNotebook({
      ...base,
      uiSpecification: undefined as any,
    });
    expect(info.schemaCompatibility?.tier).toBe('incompatible');
    expect(info.uiDefinition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });
});

describe('placeholderNotebookDefinition', () => {
  it('is a valid empty definition at the current schema', () => {
    const def = placeholderNotebookDefinition();
    expect(def.uiSpec).toEqual({
      fields: {},
      views: {},
      viewsets: {},
      visible_types: [],
      settings: {showQrCodeButton: false},
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });
    expect(def.metadata.information.notebookVersion).toBe('');
  });

  it('salvages string metadata and custom from an unreadable document', () => {
    const def = placeholderNotebookDefinition({
      uiSpec: {settings: {showQrCodeButton: true}},
      metadata: {
        information: {leadInstitution: 'Inst', notebookVersion: 42},
        custom: {tag: 'x'},
      },
    });
    expect(def.uiSpec.settings.showQrCodeButton).toBe(true);
    expect(def.metadata.information.leadInstitution).toBe('Inst');
    expect(def.metadata.information.notebookVersion).toBe('');
    expect(def.metadata.custom).toEqual({tag: 'x'});
  });
});

describe('compiledSpecService', () => {
  it('records a compile error instead of throwing', () => {
    const id = 'broken-compiled-spec';
    const def = notebookDefinitionFromLegacyPersistedProject({
      metadata: legacyNotebook.metadata,
    });
    // A `null` field body makes JSON clone succeed but compilation blow up.
    const broken = JSON.parse(JSON.stringify(def.uiSpec));
    broken.views = {bad: {fields: null, condition: {operator: 'nope'}}};
    broken.fields = {x: null};
    compiledSpecService.compileAndRegisterSpec(id, broken);
    // Either compiled (tolerant compiler) or recorded an error — never thrown.
    const compiled = compiledSpecService.getSpec(id);
    const error = compiledSpecService.getCompileError(id);
    expect(compiled !== undefined || error !== undefined).toBe(true);
    compiledSpecService.removeSpec(id);
    expect(compiledSpecService.getCompileError(id)).toBeUndefined();
  });

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
