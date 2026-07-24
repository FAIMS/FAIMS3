/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: devtools.ts
 * Description:
 *    Tools used in development and testing of FAIMS, including bulk generation
 *    of random records with optional map geometries and attachment population.
 */

import {nowIso, nowMs} from '../time';
import {
  ProjectID,
  upsertFAIMSData,
  Record,
  generateFAIMSDataID,
  getDataDB,
} from '@faims3/data-model';
import {getUiSpecModel} from './notebooks';
import {randomInt} from 'crypto';
import {readFileSync} from 'node:fs';
import * as Exceptions from '../exceptions';
import {getDataDb} from '.';

export type RandomRecordOptions = {
  /** When false, file/photo fields are left empty (much faster for large batches). */
  includeAttachments?: boolean;
  /** Max records created concurrently (dev tooling only). */
  parallelism?: number;
};

/** Default concurrent upserts when bulk-generating test records. */
const DEFAULT_RECORD_GENERATION_PARALLELISM = 10;

/**
 * Runs `count` invocations of `task` with at most `concurrency` in flight.
 * Preserves result order by index.
 */
const runWithConcurrency = async <T>(
  count: number,
  concurrency: number,
  task: () => Promise<T>
): Promise<T[]> => {
  if (count === 0) {
    return [];
  }

  const results: T[] = Array.from({length: count});
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, count);

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task();
    }
  };

  await Promise.all(Array.from({length: workerCount}, worker));
  return results;
};

/**
 * Bulk-create random records for developer-mode testing.
 *
 * Loads the notebook UI spec once and reuses the DB connection across workers.
 * Map fields receive random geometries within mainland Australia when present.
 *
 * @param project_id - Target notebook
 * @param count - Number of records to create (1–1000)
 * @param options - Attachment population and concurrency
 * @returns IDs of created records, in generation order
 */
export const createManyRandomRecords = async (
  project_id: ProjectID,
  count: number,
  options: RandomRecordOptions = {}
): Promise<string[]> => {
  const dataDb = await getDataDb(project_id);
  const uiSpec = await getUiSpecModel(project_id);
  if (!uiSpec) {
    throw new Exceptions.ItemNotFoundException(
      `Notebook not found with id ${project_id}`
    );
  }

  const forms = Object.keys(uiSpec.viewsets);
  if (forms.length === 0) {
    throw new Exceptions.InvalidRequestException(
      `The ui spec for project with id ${project_id} has no forms in the viewsets.`
    );
  }

  const parallelism =
    options.parallelism ?? DEFAULT_RECORD_GENERATION_PARALLELISM;
  const context = {dataDb, uiSpec, options};

  return runWithConcurrency(count, parallelism, () =>
    createRandomRecordWithContext(context)
  );
};

/**
 * Create a new record for this notebook with random data values for all fields.
 *
 * @param projectId - Target notebook
 * @param options - Attachment population (defaults to including sample image data)
 */
export const createRandomRecord = async (
  projectId: ProjectID,
  options: RandomRecordOptions = {}
): Promise<string> => {
  const dataDb = await getDataDb(projectId);
  const uiSpec = await getUiSpecModel(projectId);
  if (!uiSpec) {
    throw new Exceptions.ItemNotFoundException(
      `Notebook not found with id ${projectId}`
    );
  }

  const forms = Object.keys(uiSpec.viewsets);
  if (forms.length === 0) {
    throw new Exceptions.InvalidRequestException(
      `The ui spec for project with id ${projectId} has no forms in the viewsets.`
    );
  }

  return createRandomRecordWithContext({dataDb, uiSpec, options});
};

/** Shared DB + UI spec context for bulk record generation (avoids repeated lookups). */
type RandomRecordContext = {
  dataDb: Awaited<ReturnType<typeof getDataDb>>;
  uiSpec: Awaited<ReturnType<typeof getUiSpecModel>>;
  options: RandomRecordOptions;
};

const createRandomRecordWithContext = async ({
  dataDb,
  uiSpec,
  options,
}: RandomRecordContext): Promise<string> => {
  const includeAttachments = options.includeAttachments ?? true;
  const forms = Object.keys(uiSpec.viewsets);
  const formName = forms[randomInt(forms.length)];
  const form = uiSpec.viewsets[formName];
  const views = form.views;
  const fields: string[] = [];
  views.map((view: string) => {
    uiSpec.views[view].fields.map((f: string) => fields.push(f));
  });
  // get the types of the fields
  const field_types: {[key: string]: string} = {};
  fields.map((field: string) => {
    field_types[field] =
      uiSpec.fields[field]['type-returned'] || 'faims-core::String';
  });
  const values: {[key: string]: any} = {};
  fields.map((field: string) => {
    values[field] = generateValue(uiSpec.fields[field], {includeAttachments});
  });

  const annotations: {[key: string]: any} = {};
  fields.map((field: string) => {
    annotations[field] = {annotation: '', uncertainty: false};
  });

  const newRecord: Record = {
    record_id: generateFAIMSDataID(),
    data: values,
    type: formName,
    updated_by: 'admin',
    updated: new Date(),
    field_types: field_types,
    ugc_comment: '',
    relationship: {},
    deleted: false,
    revision_id: null,
    annotations: annotations,
  };
  const result = await upsertFAIMSData({dataDb, record: newRecord});
  return result;
};

const SAMPLE_IMAGE_FILE = 'test/test-attachment-image.jpg';

let cachedSampleAttachmentBuffer: Buffer | null = null;

const getSampleAttachmentFieldValue = () => {
  if (cachedSampleAttachmentBuffer === null) {
    cachedSampleAttachmentBuffer = readFileSync(SAMPLE_IMAGE_FILE);
  }
  return [{type: 'image/jpeg', data: cachedSampleAttachmentBuffer}];
};

/** Approximate mainland Australia bounding box (WGS84). */
const AUSTRALIA_BBOX = {
  minLon: 112.911,
  maxLon: 153.639,
  minLat: -43.643,
  maxLat: -10.668,
} as const;

type GeoJSONGeometry =
  | {type: 'Point'; coordinates: [number, number]}
  | {type: 'LineString'; coordinates: [number, number][]}
  | {type: 'Polygon'; coordinates: [number, number][][]};

const randomInRange = (min: number, max: number): number =>
  min + randomInt(Math.floor((max - min) * 10000)) / 10000;

const randomAustraliaCoordinate = (): [number, number] => [
  randomInRange(AUSTRALIA_BBOX.minLon, AUSTRALIA_BBOX.maxLon),
  randomInRange(AUSTRALIA_BBOX.minLat, AUSTRALIA_BBOX.maxLat),
];

const createFeatureCollection = (geometry: GeoJSONGeometry) => ({
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry,
      properties: null,
    },
  ],
});

const generateRandomPointGeometry = (): GeoJSONGeometry => ({
  type: 'Point',
  coordinates: randomAustraliaCoordinate(),
});

const generateRandomLineStringGeometry = (): GeoJSONGeometry => {
  const pointCount = 2 + randomInt(4);
  const coordinates = Array.from(
    {length: pointCount},
    randomAustraliaCoordinate
  );
  return {type: 'LineString', coordinates};
};

const generateRandomPolygonGeometry = (): GeoJSONGeometry => {
  const margin = 0.15;
  const centerLon = randomInRange(
    AUSTRALIA_BBOX.minLon + margin,
    AUSTRALIA_BBOX.maxLon - margin
  );
  const centerLat = randomInRange(
    AUSTRALIA_BBOX.minLat + margin,
    AUSTRALIA_BBOX.maxLat - margin
  );
  const halfSize = 0.005 + randomInt(50) / 1000;
  const ring: [number, number][] = [
    [centerLon - halfSize, centerLat - halfSize],
    [centerLon + halfSize, centerLat - halfSize],
    [centerLon + halfSize, centerLat + halfSize],
    [centerLon - halfSize, centerLat + halfSize],
    [centerLon - halfSize, centerLat - halfSize],
  ];
  return {type: 'Polygon', coordinates: [ring]};
};

const generateMapFormFieldValue = (field: any) => {
  // Match MapFormField featureType (Point, LineString, Polygon) for realistic exports.
  const featureType = field['component-parameters']?.featureType ?? 'Point';
  switch (featureType) {
    case 'Polygon':
      return createFeatureCollection(generateRandomPolygonGeometry());
    case 'LineString':
      return createFeatureCollection(generateRandomLineStringGeometry());
    case 'Point':
    default:
      return createFeatureCollection(generateRandomPointGeometry());
  }
};

const generateTakePointFieldValue = () => ({
  type: 'Feature' as const,
  properties: {
    timestamp: nowMs(),
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 20,
    altitude_accuracy: null,
  },
  geometry: generateRandomPointGeometry(),
});

const generateValue = (field: any, options: {includeAttachments: boolean}) => {
  //console.log('generateValue', field);
  const fieldType = field['type-returned'];
  if (field['component-parameters'].hrid) {
    // create a nice HRID like thing
    return 'Bobalooba' + randomInt(10000).toString();
  }

  if (field['component-name'] === 'Select') {
    const options = field['component-parameters'].ElementProps.options.map(
      (o: any) => o.value
    );
    return options[randomInt(options.length)];
  }

  if (field['component-name'] === 'MultiSelect') {
    const options = field['component-parameters'].ElementProps.options.map(
      (o: any) => o.value
    );
    // value is an array
    return [options[randomInt(options.length)]];
  }

  if (field['component-name'] === 'MapFormField') {
    return generateMapFormFieldValue(field);
  }

  if (field['component-name'] === 'TakePoint') {
    return generateTakePointFieldValue();
  }

  // TODO: use 'faker' to generate more realistic data
  switch (fieldType) {
    case 'faims-core::String':
      return 'Bobalooba';
    case 'faims-attachment::Files': {
      if (!options.includeAttachments) {
        return null;
      }
      return getSampleAttachmentFieldValue();
    }
    case 'faims-core::Integer':
      return randomInt(100);
    case 'faims-core::Bool':
      return randomInt(10) > 5;
    case 'faims-core::Date':
      return nowIso();
    case 'faims-pos::Location':
      return generateTakePointFieldValue();
    default:
      return '';
  }
};

/**
 * Validate the documents in a project database at a low level to spot
 * any missing or incomplete records
 *
 * @param project_id Project id
 * @returns {errors: string[]} an array of error strings if any found
 */
export const validateProjectDatabase = async (project_id: ProjectID) => {
  const dataDB = await getDataDB(project_id);

  // get all docs and set up sets of each type that we'll use as a tally
  const allDocs = await dataDB.allDocs();

  // an array of records to drive the validation
  const recordIDs = allDocs.rows
    .filter((doc: any) => doc.id.startsWith('rec'))
    .map((doc: any) => doc.id);

  // these are all sets as we will remove ids as we see them
  const revisionIDs = new Set<string>(
    allDocs.rows
      .filter((doc: any) => doc.id.startsWith('frev'))
      .map((doc: any) => doc.id)
  );
  const avpIDs = new Set<string>(
    allDocs.rows
      .filter((doc: any) => doc.id.startsWith('avp'))
      .map((doc: any) => doc.id)
  );
  const attIDs = new Set<string>(
    allDocs.rows
      .filter((doc: any) => doc.id.startsWith('att'))
      .map((doc: any) => doc.id)
  );

  const errors: string[] = [];

  if (recordIDs) {
    for (let i = 0; i < recordIDs.length; i++) {
      try {
        const doc = await dataDB.get(recordIDs[i]);
        for (let j = 0; j < doc.revisions.length; j++) {
          const rev = doc.revisions[j];
          try {
            const rev_doc = await dataDB.get(rev);
            revisionIDs.delete(rev);
            const avps = Object.values(rev_doc.avps);
            for (let k = 0; k < avps.length; k++) {
              try {
                const avp_doc = await dataDB.get(avps[k]);
                avpIDs.delete(avp_doc._id);
                // check for any attachments
                if (avp_doc.faims_attachments) {
                  for (let l = 0; l < avp_doc.faims_attachments.length; l++) {
                    const att = avp_doc.faims_attachments[l];
                    try {
                      await dataDB.get(att.attachment_id);
                      attIDs.delete(att.attachment_id);
                    } catch {
                      errors.push(
                        `missing attachment ${att.attachment_id} on ${avps[k]} in ${rev} of ${doc._id}`
                      );
                    }
                  }
                }
              } catch {
                errors.push(
                  `missing avp document ${avps[k]} in ${rev} of ${doc._id}`
                );
              }
            }
          } catch {
            errors.push(
              `missing revision document ${rev} in ${doc._id} which has ${doc.revisions.length} revisions`
            );
          }
        }
      } catch {
        errors.push(`could not fetch details of record ${recordIDs[i]}`);
      }
    }
  }

  if (revisionIDs.size > 0)
    errors.push(
      `found ${
        revisionIDs.size
      } revisions not referenced in any record: ${Array.from(revisionIDs)}`
    );

  if (avpIDs.size > 0)
    errors.push(
      `found ${
        avpIDs.size
      } AVP documents not referenced in any revision: ${Array.from(avpIDs)}`
    );

  if (attIDs.size > 0)
    errors.push(
      `found ${
        attIDs.size
      } attachment documents not referenced in any revision: ${Array.from(
        attIDs
      )}`
    );

  return {errors: errors};
};
