/**
 * Shared fixtures for the two walks over a record's Child-type links: the
 * status report and the recursive revision history. Both run against the one
 * notebook, so a change to its child links is exercised by both.
 */
import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  compileUiSpecConditionals,
  CompiledNotebookUiSpec,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FormUpdateData,
  NotebookDefinition,
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

export const CHILD_PAIR: [string, string] = ['is child of', 'has child'];
export const USER = 'test-user';
export const PROJECT = 'test-project';

/** Forward child link as stored in a RelatedRecordSelector field value. */
export const link = (recordId: string) => ({
  record_id: recordId,
  relation_type_vocabPair: CHILD_PAIR,
});

const uiSpecPath = path.join(__dirname, 'statusReportUiSpec.json');

/** A fresh, uncompiled notebook spec, for tests that mutate one. */
export const readRawUiSpec = () =>
  (JSON.parse(fs.readFileSync(uiSpecPath, 'utf-8')) as NotebookDefinition)
    .uiSpec;

// Conditionals are compiled as they are in the app/api, so visibility-aware
// completion behaves the same here.
const rawUiSpec = readRawUiSpec();
compileUiSpecConditionals(rawUiSpec);
export const childTreeUiSpec = rawUiSpec as unknown as CompiledNotebookUiSpec;

/**
 * A fresh in-memory database and an engine over it.
 *
 * @param databaseName - Per-suite name, so suites cannot share state
 * @returns The raw Pouch handle, for tests that corrupt documents directly,
 *   alongside the typed handle and the engine
 */
export const createTestEngine = (databaseName: string) => {
  const rawDb = new PouchDB(databaseName, {adapter: 'memory'});
  const db = rawDb as unknown as DatabaseInterface<DataDocument>;
  return {
    rawDb,
    db,
    engine: new DataEngine({dataDb: db, uiSpec: childTreeUiSpec}),
  };
};

/** Creates a record with initial data, returning its ids. */
export const createRecord = async (
  engine: DataEngine,
  formId: string,
  initial: FormUpdateData = {},
  createdBy = USER
) => {
  const {record, revision} = await engine.form.createRecord({
    formId,
    createdBy,
    initial,
  });
  return {recordId: record._id, revisionId: revision._id};
};

/** The child-field entry for fieldId; fails the test if absent. */
export const childField = <TField extends {fieldId: string}>(
  node: {childFields: TField[]},
  fieldId: string
): TField => {
  const field = node.childFields.find(f => f.fieldId === fieldId);
  expect(field).toBeDefined();
  return field!;
};
