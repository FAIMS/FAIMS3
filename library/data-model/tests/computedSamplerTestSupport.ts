// SPDX-License-Identifier: Apache-2.0
/**
 * Shared fixtures for the Computed Sampler notebook
 * (api/notebooks/computed-sampler.json): an in-memory engine over it and
 * builders for its records. Used by the integration tests and the benchmark,
 * so both exercise the notebook reviewers can load in the app.
 */
import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  compileUiSpecConditionals,
  CompiledNotebookUiSpec,
  couchInitialiser,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FormUpdateData,
  initDataDB,
  registerClient,
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

export const SAMPLER_PROJECT = 'computed-sampler';
export const SAMPLER_USER = 'sampler-user';

const samplerPath = path.join(
  __dirname,
  '../../../api/notebooks/computed-sampler.json'
);

/** The sampler's uiSpec, compiled as the app and API compile it. */
export const readSamplerUiSpec = (): CompiledNotebookUiSpec => {
  const uiSpec = JSON.parse(fs.readFileSync(samplerPath, 'utf-8'))
    .uiSpecification.uiSpec;
  compileUiSpecConditionals(uiSpec);
  return uiSpec as CompiledNotebookUiSpec;
};

/**
 * A fresh in-memory data DB, initialised with the design documents the list
 * and export reads need, and an engine over it.
 *
 * @param databaseName - Per-suite name, so suites cannot share state
 */
export const createSamplerEngine = async (databaseName: string) => {
  const db = new PouchDB(databaseName, {
    adapter: 'memory',
  }) as unknown as DatabaseInterface<DataDocument>;
  await couchInitialiser({
    db,
    content: initDataDB({projectId: SAMPLER_PROJECT}),
    config: {forceWrite: true, applyPermissions: false},
  });
  // The export iterator lists records through the registered lookup, not the
  // database it is passed
  registerClient({
    getDataDB: async () => db,
    shouldDisplayRecord: async () => true,
  });
  const uiSpec = readSamplerUiSpec();
  return {db, uiSpec, engine: new DataEngine({dataDb: db, uiSpec})};
};

/** Wraps raw values as form data entries. */
const asFormData = (values: Record<string, unknown>): FormUpdateData =>
  Object.fromEntries(
    Object.entries(values).map(([fieldId, data]) => [fieldId, {data}])
  );

/** Creates a top-level record, returning its id. */
export const createSamplerRecord = async (
  engine: DataEngine,
  formId: string,
  values: Record<string, unknown>
): Promise<string> => {
  const {record} = await engine.form.createRecord({
    formId,
    createdBy: SAMPLER_USER,
    initial: asFormData(values),
  });
  return record._id;
};

/**
 * Writes values to a record's head revision in place. updateRevision replaces
 * the revision's values, so the stored ones are carried over.
 */
export const setSamplerValues = async (
  engine: DataEngine,
  recordId: string,
  values: Record<string, unknown>
): Promise<void> => {
  // The raw read: resolved computed values must not be written back
  const stored = await engine.hydrated.getHydratedRecord({recordId});
  const current = Object.fromEntries(
    Object.entries(stored.data).map(([fieldId, field]) => [fieldId, field.data])
  );
  await engine.form.updateRevision({
    revisionId: stored.revision._id,
    recordId,
    update: asFormData({...current, ...values}),
    mode: 'new',
    updatedBy: SAMPLER_USER,
  });
};
/**
 * Creates a Feature as a child of a Site.
 *
 * @param siteLinks - What the Site's Features field holds so far
 * @returns The Feature's id and the value the Site's Features field must
 *   now hold
 */
export const createFeature = async (
  engine: DataEngine,
  siteId: string,
  values: Record<string, unknown>,
  siteLinks: unknown = undefined
) => {
  const {record, linked} = await engine.form.createRelatedRecord({
    parentRecordId: siteId,
    parentFieldId: 'Site-Features',
    createdBy: SAMPLER_USER,
    parentFieldValue: siteLinks,
  });
  await setSamplerValues(engine, record._id, values);
  return {recordId: record._id, siteLinks: linked};
};

/** The value a single-link field holds when linked to `recordId`. */
export const singleLinkTo = (recordId: string, pair: [string, string]) => [
  {record_id: recordId, relation_type_vocabPair: pair},
];

export const CALIBRATION_PAIR: [string, string] = [
  'is calibrated by',
  'calibrates',
];
export const SAMPLE_PAIR: [string, string] = ['follows', 'is followed by'];

/** A field's resolved value on a record's head revision. */
export const readValue = async (
  engine: DataEngine,
  recordId: string,
  fieldId: string
): Promise<unknown> =>
  (await engine.form.getExistingFormData({recordId})).data[fieldId]?.data;

/** Soft-deletes a record. */
export const deleteSamplerRecord = async (
  engine: DataEngine,
  recordId: string
): Promise<void> => {
  await engine.deleteRecord({
    recordId,
    baseRevisionId: await engine.form.getCurrentRevisionId({recordId}),
    userId: SAMPLER_USER,
  });
};
