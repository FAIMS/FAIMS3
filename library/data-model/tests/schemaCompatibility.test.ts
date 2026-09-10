import {sampleNotebook} from '../src/data_storage/migrations/notebookMigrations/test-notebook-V1';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  migrateNotebook,
} from '../src/data_storage/migrations/notebookMigrations';
import {notebookUiSpecificationNeedsMigration} from '../src/uiSpecification/normalize';
import {
  assessNotebookSchemaCompatibility,
  IncompatibleNotebookSchemaError,
  ingestNotebookUiSpecification,
} from '../src/uiSpecification/schemaCompatibility';
import {getNotebookSchemaVersion} from '../src/data_storage/migrations/notebookMigrations/version';
import {
  compareNotebookSchemaSemver,
  isNotebookSchemaSemver,
  parseNotebookSchemaSemver,
} from '../src/uiSpecification/schemaVersion';

const current = () =>
  JSON.parse(JSON.stringify(migrateNotebook(sampleNotebook).migrated));

const withVersion = (version: string) => {
  const nb = current();
  nb.uiSpec.schemaVersion = version;
  return nb;
};

describe('getNotebookSchemaVersion', () => {
  it('prefers uiSpec.schemaVersion when a leftover legacy key is also present', () => {
    expect(
      getNotebookSchemaVersion({
        metadata: {schema_version: '7.0'},
        uiSpec: {schemaVersion: '1.0.0'},
      })
    ).toBe('1.0.0');
  });

  it('falls back to metadata.schema_version when uiSpec has no stamp', () => {
    expect(
      getNotebookSchemaVersion({metadata: {schema_version: '7.0'}})
    ).toBe('7.0');
  });
});

describe('strict schema semver primitives', () => {
  it.each(['1.0.0', '0.0.0', '12.34.56'])('accepts %s', v => {
    expect(isNotebookSchemaSemver(v)).toBe(true);
    expect(parseNotebookSchemaSemver(v)).toBeDefined();
  });

  it.each([
    '7.0',
    '1.0',
    '1',
    'v1.0.0',
    '1.0.0-beta',
    '01.0.0',
    '1.0.0.0',
    '',
    ' 1.0.0',
  ])('rejects %p', v => {
    expect(isNotebookSchemaSemver(v)).toBe(false);
    expect(parseNotebookSchemaSemver(v)).toBeUndefined();
  });

  it('compares numerically, not lexically', () => {
    expect(compareNotebookSchemaSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareNotebookSchemaSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareNotebookSchemaSemver('1.0.9', '1.1.0')).toBeLessThan(0);
    expect(() => compareNotebookSchemaSemver('7.0', '1.0.0')).toThrow();
  });
});

describe('assessNotebookSchemaCompatibility', () => {
  const app = '1.2.3';

  it.each([undefined, null, '', '1.0', '7.0', 'garbage'])(
    'classifies %p as legacy needing migration',
    v => {
      const c = assessNotebookSchemaCompatibility(v, app);
      expect(c).toMatchObject({
        tier: 'compatible',
        relation: 'legacy',
        requiresMigration: true,
        appSchemaVersion: app,
      });
    }
  );

  it('current → compatible without migration', () => {
    expect(assessNotebookSchemaCompatibility('1.2.3', app)).toMatchObject({
      tier: 'compatible',
      relation: 'current',
      requiresMigration: false,
    });
  });

  it('older epoch → compatible with migration', () => {
    expect(assessNotebookSchemaCompatibility('1.0.0', app)).toMatchObject({
      tier: 'compatible',
      relation: 'older',
      requiresMigration: true,
    });
  });

  it('newer patch → compatible, silent', () => {
    expect(assessNotebookSchemaCompatibility('1.2.9', app)).toMatchObject({
      tier: 'compatible',
      relation: 'newer-patch',
      requiresMigration: false,
    });
  });

  it('newer minor → degraded', () => {
    expect(assessNotebookSchemaCompatibility('1.3.0', app)).toMatchObject({
      tier: 'degraded',
      relation: 'newer-minor',
      requiresMigration: false,
    });
  });

  it('newer major → incompatible', () => {
    const c = assessNotebookSchemaCompatibility('2.0.0', app);
    expect(c).toMatchObject({tier: 'incompatible', relation: 'newer-major'});
    expect(c.reason).toMatch(/Update the app/);
  });

  it('defaults appVersion to CURRENT', () => {
    expect(
      assessNotebookSchemaCompatibility(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION)
    ).toMatchObject({tier: 'compatible', relation: 'current'});
  });
});

describe('notebookUiSpecificationNeedsMigration', () => {
  it('is true for legacy and older versions', () => {
    expect(notebookUiSpecificationNeedsMigration(sampleNotebook as any)).toBe(
      true
    );
    expect(
      notebookUiSpecificationNeedsMigration({uiSpec: {schemaVersion: '7.0'}})
    ).toBe(true);
  });

  it('is false for current and never true for newer strict versions', () => {
    expect(
      notebookUiSpecificationNeedsMigration({
        uiSpec: {schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION},
      })
    ).toBe(false);
    expect(
      notebookUiSpecificationNeedsMigration({uiSpec: {schemaVersion: '1.0.1'}})
    ).toBe(false);
    expect(
      notebookUiSpecificationNeedsMigration({uiSpec: {schemaVersion: '99.0.0'}})
    ).toBe(false);
  });
});

describe('ingestNotebookUiSpecification', () => {
  it('collapses a legacy notebook and reports compatible', () => {
    const result = ingestNotebookUiSpecification(sampleNotebook);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(result.compatibility).toMatchObject({
      tier: 'compatible',
      relation: 'legacy',
      notebookSchemaVersion: '1.0',
    });
  });

  it('parses a current notebook without migrating', () => {
    const result = ingestNotebookUiSpecification(current());
    expect(result.ok).toBe(true);
    expect(result.compatibility.relation).toBe('current');
  });

  it('accepts a newer patch silently', () => {
    const result = ingestNotebookUiSpecification(withVersion('1.0.7'), {
      appSchemaVersion: '1.0.0',
    });
    expect(result.ok).toBe(true);
    expect(result.compatibility).toMatchObject({
      tier: 'compatible',
      relation: 'newer-patch',
    });
    // Version stamp is preserved, not rewritten to the app's version.
    expect(result.definition?.uiSpec.schemaVersion).toBe('1.0.7');
  });

  it('renders a newer minor in degraded mode with relaxed parsing', () => {
    const nb = withVersion('1.1.0');
    // Simulate a future field property the strict schema would not know about
    // and a future top-level key.
    nb.uiSpec.futureSetting = {enabled: true};
    nb.futureTopLevel = 'x';
    const result = ingestNotebookUiSpecification(nb, {
      appSchemaVersion: '1.0.0',
    });
    expect(result.ok).toBe(true);
    expect(result.compatibility).toMatchObject({
      tier: 'degraded',
      relation: 'newer-minor',
    });
    expect((result.definition as any).uiSpec.futureSetting).toEqual({
      enabled: true,
    });
    expect(
      Object.keys(result.definition!.uiSpec.fields).length
    ).toBeGreaterThan(0);
  });

  it('degraded mode defaults missing settings and metadata', () => {
    const nb = withVersion('1.1.0');
    delete nb.uiSpec.settings;
    delete nb.metadata;
    const result = ingestNotebookUiSpecification(nb, {
      appSchemaVersion: '1.0.0',
    });
    expect(result.ok).toBe(true);
    expect(result.definition?.uiSpec.settings).toEqual({
      showQrCodeButton: false,
    });
    expect(result.definition?.metadata.information).toEqual({
      notebookVersion: '',
      purposeMarkdown: '',
      projectLeadLabel: '',
      leadInstitution: '',
    });
  });

  it('degraded mode still requires the form graph containers', () => {
    const result = ingestNotebookUiSpecification(
      {uiSpec: {schemaVersion: '1.1.0'}, metadata: {}},
      {appSchemaVersion: '1.0.0'}
    );
    expect(result.ok).toBe(false);
    expect(result.compatibility.tier).toBe('incompatible');
    expect(result.error).toBeInstanceOf(IncompatibleNotebookSchemaError);
  });

  it('rejects a newer major without parsing the graph', () => {
    const result = ingestNotebookUiSpecification(withVersion('2.0.0'), {
      appSchemaVersion: '1.0.0',
    });
    expect(result.ok).toBe(false);
    expect(result.compatibility).toMatchObject({
      tier: 'incompatible',
      relation: 'newer-major',
      notebookSchemaVersion: '2.0.0',
      appSchemaVersion: '1.0.0',
    });
    expect(result.error?.compatibility.tier).toBe('incompatible');
  });

  it('reports incompatible when the collapse cannot handle the legacy version', () => {
    const nb = current();
    nb.uiSpec.schemaVersion = '8.0';
    const result = ingestNotebookUiSpecification(nb);
    expect(result.ok).toBe(false);
    expect(result.compatibility.relation).toBe('legacy');
    expect(result.compatibility.tier).toBe('incompatible');
    expect(result.compatibility.reason).toMatch(/Unrecognised legacy/);
  });

  it('reports incompatible when a current-version document fails strict validation', () => {
    const nb = current();
    delete nb.uiSpec.settings;
    const result = ingestNotebookUiSpecification(nb);
    expect(result.ok).toBe(false);
    expect(result.compatibility.tier).toBe('incompatible');
    expect(result.compatibility.reason).toMatch(/failed validation/);
  });

  it('reports incompatible for a non-object payload', () => {
    for (const bad of [undefined, null, 'x', 42, []]) {
      const result = ingestNotebookUiSpecification(bad);
      expect(result.ok).toBe(false);
      expect(result.compatibility.tier).toBe('incompatible');
    }
  });
});
