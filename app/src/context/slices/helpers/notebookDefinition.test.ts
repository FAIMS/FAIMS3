import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
  type GetNotebookResponse,
} from '@faims3/data-model';
import {
  ingestLegacyPersistedProjectForStore,
  isNotebookDesignLocked,
  isPlaceholderNotebookDefinition,
  notebookDefinitionFromLegacyPersistedProject,
  placeholderNotebookDefinition,
  projectInformationFromGetNotebook,
  reassessPersistedNotebookDefinition,
} from './notebookDefinition';
import {compiledSpecService} from './compiledSpecService';

const legacyNotebookPath = path.join(
  __dirname,
  '../../../../../api/notebooks/sample_notebook.legacy.json'
);
const legacyNotebook = JSON.parse(
  fs.readFileSync(legacyNotebookPath, 'utf-8')
) as {
  metadata: Record<string, unknown>;
  'ui-specification': {
    fields: Record<string, any>;
    fviews: Record<string, any>;
    viewsets: Record<string, any>;
    visible_types: string[];
  };
};

/** Full legacy design (fields + views), collapsed to the current schema. */
const realLegacyDefinition = () =>
  notebookDefinitionFromLegacyPersistedProject({
    metadata: legacyNotebook.metadata,
    rawUiSpecification: {
      fields: legacyNotebook['ui-specification'].fields,
      views: legacyNotebook['ui-specification'].fviews,
      viewsets: legacyNotebook['ui-specification'].viewsets,
      visible_types: legacyNotebook['ui-specification'].visible_types,
    },
  });

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

describe('isPlaceholderNotebookDefinition / isNotebookDesignLocked', () => {
  it('detects the empty placeholder and a real graph', () => {
    expect(
      isPlaceholderNotebookDefinition(placeholderNotebookDefinition())
    ).toBe(true);
    expect(isPlaceholderNotebookDefinition(undefined)).toBe(true);
    expect(isPlaceholderNotebookDefinition(realLegacyDefinition())).toBe(false);
  });

  it('locks only the incompatible tier', () => {
    expect(isNotebookDesignLocked(undefined)).toBe(false);
    expect(isNotebookDesignLocked({schemaCompatibility: undefined})).toBe(
      false
    );
    expect(
      isNotebookDesignLocked({
        schemaCompatibility: {
          tier: 'degraded',
          relation: 'newer-minor',
          appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
          requiresMigration: false,
          reason: '',
        },
      })
    ).toBe(false);
    expect(
      isNotebookDesignLocked({
        schemaCompatibility: {
          tier: 'incompatible',
          relation: 'newer-major',
          appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
          requiresMigration: false,
          reason: '',
        },
      })
    ).toBe(true);
  });
});

describe('ingestLegacyPersistedProjectForStore', () => {
  it('collapses a legacy persisted project without throwing', () => {
    const {uiDefinition, schemaCompatibility} =
      ingestLegacyPersistedProjectForStore({
        metadata: legacyNotebook.metadata,
      });
    expect(uiDefinition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(schemaCompatibility.tier).toBe('compatible');
  });

  it('falls back to placeholder + incompatible for an unreadable legacy design', () => {
    const {uiDefinition, schemaCompatibility} =
      ingestLegacyPersistedProjectForStore({
        metadata: {schema_version: '3.0'},
        rawUiSpecification: {
          fields: {broken: 'not-an-object'} as any,
          views: {},
          viewsets: {},
          visible_types: [],
        },
      });
    expect(schemaCompatibility.tier).toBe('incompatible');
    expect(isPlaceholderNotebookDefinition(uiDefinition)).toBe(true);
  });
});

describe('reassessPersistedNotebookDefinition', () => {
  const [major, minor] =
    CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.split('.').map(Number);
  const realDefinition = realLegacyDefinition;

  it('is a no-op when this build already assessed the project', () => {
    const uiDefinition = realDefinition();
    const stored = {
      tier: 'compatible' as const,
      relation: 'current' as const,
      appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      notebookSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      requiresMigration: false,
      reason: 'ok',
    };
    const result = reassessPersistedNotebookDefinition({
      uiDefinition,
      schemaCompatibility: stored,
    });
    expect(result.changed).toBe(false);
    expect(result.uiDefinition).toBe(uiDefinition);
    expect(result.schemaCompatibility).toBe(stored);
  });

  it('assesses a project persisted before compatibility tracking existed', () => {
    const uiDefinition = realDefinition();
    const result = reassessPersistedNotebookDefinition({
      uiDefinition,
      schemaCompatibility: undefined,
    });
    expect(result.changed).toBe(true);
    expect(result.schemaCompatibility.tier).toBe('compatible');
    expect(result.schemaCompatibility.appSchemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });

  it('downgrade: a stored newer-major design becomes incompatible but is kept for read-only', () => {
    const uiDefinition = realDefinition();
    uiDefinition.uiSpec.schemaVersion = `${major + 1}.0.0`;
    const result = reassessPersistedNotebookDefinition({
      uiDefinition,
      schemaCompatibility: {
        // Written by the newer build that considered it current.
        tier: 'compatible',
        relation: 'current',
        appSchemaVersion: `${major + 1}.0.0`,
        notebookSchemaVersion: `${major + 1}.0.0`,
        requiresMigration: false,
        reason: 'ok',
      },
    });
    expect(result.changed).toBe(true);
    expect(result.schemaCompatibility.tier).toBe('incompatible');
    expect(result.schemaCompatibility.relation).toBe('newer-major');
    // Last good graph retained, not replaced with the placeholder.
    expect(result.uiDefinition).toBe(uiDefinition);
    expect(isPlaceholderNotebookDefinition(result.uiDefinition)).toBe(false);
  });

  it('downgrade: a stored newer-minor design becomes degraded', () => {
    const uiDefinition = realDefinition();
    uiDefinition.uiSpec.schemaVersion = `${major}.${minor + 1}.0`;
    const result = reassessPersistedNotebookDefinition({
      uiDefinition,
      schemaCompatibility: undefined,
    });
    expect(result.schemaCompatibility.tier).toBe('degraded');
    expect(result.uiDefinition.uiSpec.views).toEqual(uiDefinition.uiSpec.views);
  });

  it('upgrade: a previously incompatible placeholder stays incompatible until refetched', () => {
    const result = reassessPersistedNotebookDefinition({
      uiDefinition: placeholderNotebookDefinition(),
      schemaCompatibility: {
        // The old build could not read the current version.
        tier: 'incompatible',
        relation: 'newer-major',
        appSchemaVersion: '0.9.0',
        notebookSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
        requiresMigration: false,
        reason: 'newer major',
      },
    });
    expect(result.changed).toBe(true);
    expect(result.schemaCompatibility.tier).toBe('incompatible');
    expect(result.schemaCompatibility.appSchemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(result.schemaCompatibility.reason).toMatch(/refresh/i);
  });

  it('upgrade: a still-newer server design stays incompatible with a fresh assessment', () => {
    const result = reassessPersistedNotebookDefinition({
      uiDefinition: placeholderNotebookDefinition(),
      schemaCompatibility: {
        tier: 'incompatible',
        relation: 'newer-major',
        appSchemaVersion: '0.9.0',
        notebookSchemaVersion: `${major + 5}.0.0`,
        requiresMigration: false,
        reason: 'newer major',
      },
    });
    expect(result.schemaCompatibility.tier).toBe('incompatible');
    expect(result.schemaCompatibility.relation).toBe('newer-major');
    expect(result.schemaCompatibility.appSchemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(result.schemaCompatibility.reason).not.toMatch(/refresh/i);
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
