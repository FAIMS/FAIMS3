import fs from 'fs';
import path from 'path';
import {sampleNotebook} from '../src/data_storage/migrations/notebookMigrations/test-notebook-V1';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  normalizeNotebookUiSpecification,
  notebookUiSpecificationNeedsMigration,
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
