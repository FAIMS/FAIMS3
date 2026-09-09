// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Harness tests: registry completeness, path finder, runner. Mirrors
 * `tests/migrationService.test.ts` for Couch DB migrations.
 */

import {isNotebookSchemaSemver} from '../../../uiSpecification/schemaVersion';
import {
  identifyNotebookSchemaMigrations,
  resolveNotebookSchemaMigrationStart,
} from './identify';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  NOTEBOOK_UI_SCHEMA_MIGRATIONS,
  NOTEBOOK_UI_SCHEMA_TARGET_VERSION,
} from './registry';
import {migrateNotebook} from './runner';
import {sampleNotebook} from './test-notebook-V1';
import {
  NOTEBOOK_SCHEMA_LEGACY,
  NotebookSchemaMigrationError,
  type NotebookSchemaMigrationDetails,
} from './types';

const noop = () => undefined;
const identity = (x: unknown) => x;

describe('Notebook schema migration registry completeness', () => {
  it('target version is strict MAJOR.MINOR.PATCH', () => {
    expect(isNotebookSchemaSemver(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION)).toBe(
      true
    );
    expect(NOTEBOOK_UI_SCHEMA_TARGET_VERSION).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });

  it('every registered step has a strict semver `to` and a semver-or-legacy `from`', () => {
    for (const step of NOTEBOOK_UI_SCHEMA_MIGRATIONS) {
      expect(isNotebookSchemaSemver(step.to)).toBe(true);
      expect(
        step.from === NOTEBOOK_SCHEMA_LEGACY ||
          isNotebookSchemaSemver(step.from)
      ).toBe(true);
      expect(step.description.length).toBeGreaterThan(0);
      expect(typeof step.migrationFunction).toBe('function');
      expect(typeof step.validateFunction).toBe('function');
    }
  });

  it('has exactly one step per `from` (no ambiguity)', () => {
    const froms = NOTEBOOK_UI_SCHEMA_MIGRATIONS.map(s => s.from);
    expect(new Set(froms).size).toBe(froms.length);
  });

  it('has a unique path from legacy to the target', () => {
    const path = identifyNotebookSchemaMigrations({
      from: NOTEBOOK_SCHEMA_LEGACY,
    });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1].to).toBe(NOTEBOOK_UI_SCHEMA_TARGET_VERSION);
  });

  it('has a path from every registered `from` to the target', () => {
    for (const step of NOTEBOOK_UI_SCHEMA_MIGRATIONS) {
      const path = identifyNotebookSchemaMigrations({from: step.from});
      expect(path[0]).toBe(step);
      expect(path[path.length - 1].to).toBe(NOTEBOOK_UI_SCHEMA_TARGET_VERSION);
    }
  });
});

describe('resolveNotebookSchemaMigrationStart', () => {
  it.each([undefined, null, '', '1.0', '7.0', '7', 'v1.0.0', '01.0.0', 42])(
    'maps %p to legacy',
    value => {
      expect(resolveNotebookSchemaMigrationStart(value)).toBe(
        NOTEBOOK_SCHEMA_LEGACY
      );
    }
  );

  it.each(['1.0.0', '1.2.3', '10.0.1'])('keeps strict semver %s', value => {
    expect(resolveNotebookSchemaMigrationStart(value)).toBe(value);
  });
});

describe('identifyNotebookSchemaMigrations', () => {
  const registry: NotebookSchemaMigrationDetails[] = [
    {
      from: NOTEBOOK_SCHEMA_LEGACY,
      to: '1.0.0',
      description: 'legacy',
      migrationFunction: identity,
      validateFunction: noop,
    },
    {
      from: '1.0.0',
      to: '1.0.1',
      description: 'patch',
      migrationFunction: identity,
      validateFunction: noop,
    },
    {
      from: '1.0.1',
      to: '1.1.0',
      description: 'minor',
      migrationFunction: identity,
      validateFunction: noop,
    },
    {
      from: '1.1.0',
      to: '2.0.0',
      description: 'major',
      migrationFunction: identity,
      validateFunction: noop,
    },
  ];

  it('returns [] when already at target', () => {
    expect(
      identifyNotebookSchemaMigrations({from: '2.0.0', to: '2.0.0', registry})
    ).toEqual([]);
  });

  it('returns ordered steps from legacy through every hop', () => {
    const path = identifyNotebookSchemaMigrations({
      from: NOTEBOOK_SCHEMA_LEGACY,
      to: '2.0.0',
      registry,
    });
    expect(path.map(s => `${s.from}→${s.to}`)).toEqual([
      'legacy→1.0.0',
      '1.0.0→1.0.1',
      '1.0.1→1.1.0',
      '1.1.0→2.0.0',
    ]);
  });

  it('starts mid-chain and stops at an intermediate target', () => {
    const path = identifyNotebookSchemaMigrations({
      from: '1.0.0',
      to: '1.1.0',
      registry,
    });
    expect(path.map(s => s.to)).toEqual(['1.0.1', '1.1.0']);
  });

  it('throws on downgrade', () => {
    expect(() =>
      identifyNotebookSchemaMigrations({from: '2.0.0', to: '1.0.0', registry})
    ).toThrow(NotebookSchemaMigrationError);
    expect(() =>
      identifyNotebookSchemaMigrations({from: '2.0.0', to: '1.0.0', registry})
    ).toThrow(/downgrade/);
  });

  it('throws when a hop is missing', () => {
    expect(() =>
      identifyNotebookSchemaMigrations({from: '1.0.0', to: '3.0.0', registry})
    ).toThrow(/Missing notebook schema migration from 2\.0\.0/);
  });

  it('throws when a hop is ambiguous', () => {
    const ambiguous = [
      ...registry,
      {
        from: '1.0.0' as const,
        to: '1.5.0' as const,
        description: 'dup',
        migrationFunction: identity,
        validateFunction: noop,
      },
    ];
    expect(() =>
      identifyNotebookSchemaMigrations({
        from: '1.0.0',
        to: '2.0.0',
        registry: ambiguous,
      })
    ).toThrow(/Ambiguous/);
  });

  it('throws when the only hop overshoots the target', () => {
    expect(() =>
      identifyNotebookSchemaMigrations({from: '1.0.1', to: '1.0.5', registry})
    ).toThrow(/overshoots/);
  });

  it('throws on a registry cycle', () => {
    const cyclic: NotebookSchemaMigrationDetails[] = [
      {
        from: '1.0.0',
        to: '1.0.1',
        description: 'a',
        migrationFunction: identity,
        validateFunction: noop,
      },
      {
        from: '1.0.1',
        to: '1.0.0',
        description: 'back',
        migrationFunction: identity,
        validateFunction: noop,
      },
    ];
    expect(() =>
      identifyNotebookSchemaMigrations({
        from: '1.0.0',
        to: '1.0.2',
        registry: cyclic,
      })
    ).toThrow(/cycle|overshoots/);
  });
});

describe('migrateNotebook (runner)', () => {
  it('collapses a schema 1.0 notebook to the current version in one call', () => {
    const {changed, migrated, applied} = migrateNotebook(sampleNotebook);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(applied.map(a => `${a.from}→${a.to}`)).toEqual(['legacy→1.0.0']);
    expect(migrated).not.toHaveProperty('ui-specification');
  });

  it('is a no-op for a notebook already at the current version', () => {
    const current = migrateNotebook(sampleNotebook).migrated;
    const again = migrateNotebook(current);
    expect(again.changed).toBe(false);
    expect(again.applied).toEqual([]);
    expect(again.migrated).toBe(current);
  });

  it('does not mutate the input', () => {
    const input = JSON.parse(JSON.stringify(sampleNotebook));
    migrateNotebook(input);
    expect(input).toEqual(sampleNotebook);
  });

  it('throws NotebookSchemaMigrationError for a newer strict version', () => {
    const newer = {
      ...migrateNotebook(sampleNotebook).migrated,
    } as any;
    newer.uiSpec = {...newer.uiSpec, schemaVersion: '99.0.0'};
    expect(() => migrateNotebook(newer)).toThrow(NotebookSchemaMigrationError);
    expect(() => migrateNotebook(newer)).toThrow(/downgrade/);
  });

  it('wraps an unknown legacy version in NotebookSchemaMigrationError', () => {
    const bogus = {
      metadata: {schema_version: '8.0'},
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: [],
      },
    };
    expect(() => migrateNotebook(bogus)).toThrow(NotebookSchemaMigrationError);
    expect(() => migrateNotebook(bogus)).toThrow(/Unrecognised legacy/);
  });

  it('wraps a validation failure with the step from/to', () => {
    // Missing ui-specification means the collapse cannot even start.
    try {
      migrateNotebook({metadata: {}});
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(NotebookSchemaMigrationError);
      const err = e as NotebookSchemaMigrationError;
      expect(err.from).toBe(NOTEBOOK_SCHEMA_LEGACY);
      expect(err.to).toBe('1.0.0');
    }
  });
});
