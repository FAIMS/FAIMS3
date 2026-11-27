// SPDX-License-Identifier: Apache-2.0
/**
 * Fixtures for the startup-migration ahead check: in-memory migrations /
 * projects / templates DBs with real design docs, and notebooks stamped with
 * a uiSpec schema version newer than this build (as the seed dataset does).
 */
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  parseNotebookSchemaSemver,
} from '@faims3/data-model';
import {expect} from 'vitest';
import {
  getMigrationDb,
  getTemplatesDb,
  initialiseDbAndKeys,
  localGetProjectsDb,
} from '../src/couchdb';
import {getAllProjectsListing} from '../src/couchdb/notebooks';
import {getTemplates} from '../src/couchdb/templates';

type ClearableDb = {
  allDocs: () => Promise<{rows: Array<{id: string; value: {rev: string}}>}>;
  remove: (id: string, rev: string) => Promise<unknown>;
};

type PuttableDb = {put: (doc: Record<string, unknown>) => Promise<unknown>};

async function clear(db: unknown): Promise<void> {
  const clearable = db as ClearableDb;
  const {rows} = await clearable.allDocs();
  for (const row of rows) {
    await clearable.remove(row.id, row.value.rev);
  }
}

/** A notebook schema version one major ahead of this build. */
export function newerNotebookSchemaVersion(): string {
  const parsed = parseNotebookSchemaSemver(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION)!;
  return `${parsed.major + 1}.0.0`;
}

/** Empty the migrations / projects / templates DBs, then reinstall design docs. */
export async function resetAheadCheckDbs(): Promise<void> {
  await Promise.all([
    clear(getMigrationDb()),
    clear(localGetProjectsDb()),
    clear(getTemplatesDb()),
  ]);
  await initialiseDbAndKeys({force: true, pushKeys: false});
}

/**
 * Store one project and one template whose `uiSpecProperties.schemaVersion`
 * is newer than this build, and check the listing views expose them.
 */
export async function seedFutureStampedNotebooks(): Promise<string> {
  const future = newerNotebookSchemaVersion();
  const uiSpecProperties = {schemaVersion: future, hash: 'future-hash'};
  await (localGetProjectsDb() as unknown as PuttableDb).put({
    _id: 'future-survey',
    name: 'Future survey',
    status: 'open',
    uiSpecProperties,
  });
  await (getTemplatesDb() as unknown as PuttableDb).put({
    _id: 'future-template',
    name: 'Future template',
    version: 1,
    uiSpecProperties,
  });

  const [projects, templates] = await Promise.all([
    getAllProjectsListing(),
    getTemplates({}),
  ]);
  expect(
    projects.map(project => project.uiSpecProperties?.schemaVersion)
  ).toContain(future);
  expect(
    templates.map(template => template.uiSpecProperties?.schemaVersion)
  ).toContain(future);
  return future;
}
