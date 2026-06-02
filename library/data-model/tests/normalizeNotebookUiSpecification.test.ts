import fs from 'fs';
import path from 'path';
import {sampleNotebook} from '../src/data_storage/migrations/notebookMigrations/test-notebook-V1';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  normalizeNotebookUiSpecification,
  notebookUiSpecificationNeedsMigration,
  parseNotebookDefinitionUpload,
  prepareNotebookUiSpecificationInputForApi,
} from '../src/uiSpecification/normalize';

describe('notebookUiSpecificationNeedsMigration', () => {
  it('returns true when schema version is missing (treated as v1)', () => {
    expect(
      notebookUiSpecificationNeedsMigration({
        metadata: {},
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: [],
        },
      })
    ).toBe(true);
  });

  it('returns true when schema version is below current', () => {
    expect(notebookUiSpecificationNeedsMigration(sampleNotebook)).toBe(true);
  });

  it('returns false when schema version is current', () => {
    const normalized = normalizeNotebookUiSpecification(sampleNotebook);
    expect(
      notebookUiSpecificationNeedsMigration(
        normalized as unknown as Record<string, unknown>
      )
    ).toBe(false);
  });
});

describe('normalizeNotebookUiSpecification', () => {
  it('migrates legacy upload to current NotebookDefinition', () => {
    const normalized = normalizeNotebookUiSpecification(sampleNotebook);
    expect(normalized.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(normalized).not.toHaveProperty('ui-specification');
    expect(normalized.metadata.information.purposeMarkdown).toBe(
      sampleNotebook.metadata.pre_description
    );
    expect(normalized.uiSpec.views).toBeDefined();
    expect(normalized.uiSpec).not.toHaveProperty('fviews');
  });

  it('accepts an already-current definition without re-migrating', () => {
    const current = normalizeNotebookUiSpecification(sampleNotebook);
    const again = normalizeNotebookUiSpecification(current);
    expect(again).toEqual(current);
  });

  it('rejects non-object input', () => {
    expect(() => normalizeNotebookUiSpecification(null)).toThrow(
      'uiSpecification must be a JSON object'
    );
  });

  it('migrates api/notebooks/sample_notebook.legacy.json (encoded fviews)', () => {
    const legacyPath = path.join(
      __dirname,
      '../../../api/notebooks/sample_notebook.legacy.json'
    );
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    expect(legacy['ui-specification']).toHaveProperty('fviews');
    expect(legacy['ui-specification']).not.toHaveProperty('views');

    const normalized = normalizeNotebookUiSpecification(legacy);
    expect(normalized.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(normalized.metadata).toBeDefined();
    expect(normalized.metadata.information.purposeMarkdown).toContain(
      'Nellies Glen'
    );
  });
});

describe('prepareNotebookUiSpecificationInputForApi', () => {
  it('accepts legacy notebook JSON (POST API loose input)', () => {
    const result = prepareNotebookUiSpecificationInputForApi(sampleNotebook);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uiSpecification).toEqual(sampleNotebook);
    }
  });

  it('accepts a wrapped uiSpecification property', () => {
    const current = normalizeNotebookUiSpecification(sampleNotebook);
    const result = prepareNotebookUiSpecificationInputForApi({
      uiSpecification: current,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uiSpecification).toEqual(current);
    }
  });

  it('accepts current NotebookDefinition at the root without rewriting uiSpec', () => {
    const current = normalizeNotebookUiSpecification(sampleNotebook);
    const result = prepareNotebookUiSpecificationInputForApi(current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uiSpecification).toEqual(current);
      expect(result.uiSpecification).toHaveProperty('uiSpec');
    }
  });

  it('rejects non-object input', () => {
    const result = prepareNotebookUiSpecificationInputForApi(null);
    expect(result.ok).toBe(false);
  });
});

describe('parseNotebookDefinitionUpload', () => {
  it('rejects legacy notebook JSON (replace expects current shape only)', () => {
    const result = parseNotebookDefinitionUpload(sampleNotebook);
    expect(result.ok).toBe(false);
  });

  it('accepts a current NotebookDefinition at the root', () => {
    const current = normalizeNotebookUiSpecification(sampleNotebook);
    const result = parseNotebookDefinitionUpload(current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uiSpecification).toEqual(current);
    }
  });

  it('rejects a wrapped uiSpecification object', () => {
    const current = normalizeNotebookUiSpecification(sampleNotebook);
    const result = parseNotebookDefinitionUpload({
      uiSpecification: current,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('top-level metadata and uiSpec');
    }
  });

  it('rejects non-object input', () => {
    const result = parseNotebookDefinitionUpload(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('JSON must be an object');
    }
  });
});
