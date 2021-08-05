import {v4 as uuidv4} from 'uuid';

import {getDataDB} from '../sync';
import {
  Datum,
  DatumMap,
  DatumID,
  DatumIDMap,
  EncodedObservation,
  Observation,
  ObservationID,
  ObservationMetadataList,
  ObservationMap,
  ProjectID,
  Revision,
  RevisionID,
  RevisionMap,
  //  OBSERVATION_INDEX_NAME,
} from '../datamodel';

type EncodedObservationMap = Map<ObservationID, EncodedObservation>;

export function generateFAIMSRevisionID(): RevisionID {
  return uuidv4();
}

function generateFAIMSDatumID(): DatumID {
  return uuidv4();
}

export async function updateHeads(
  project_id: ProjectID,
  obsid: ObservationID,
  base_revid: RevisionID,
  new_revid: RevisionID
) {
  const datadb = getDataDB(project_id);
  const observation = await getObservation(project_id, obsid);
  const heads = observation.heads;
  const old_head_index = heads.indexOf(base_revid);
  if (old_head_index !== -1) {
    heads.splice(old_head_index, 1);
  }
  heads.push(new_revid);
  observation.heads = heads.sort();
  datadb.put(observation);
}

export async function getObservation(
  project_id: ProjectID,
  obsid: ObservationID
): Promise<EncodedObservation> {
  const observations = await getObservations(project_id, [obsid]);
  const observation = observations[obsid];
  if (observation === undefined) {
    throw Error(`no such observation ${obsid}`);
  }
  return observation;
}

export async function getRevision(
  project_id: ProjectID,
  rev_id: RevisionID
): Promise<Revision> {
  const revisions = await getRevisions(project_id, [rev_id]);
  const revision = revisions[rev_id];
  if (revision === undefined) {
    throw Error(`no such revision ${rev_id}`);
  }
  return revision;
}

export async function getDatum(
  project_id: ProjectID,
  datum_id: DatumID
): Promise<Datum> {
  const datums = await getDatums(project_id, [datum_id]);
  const datum = datums[datum_id];
  if (datum === undefined) {
    throw Error(`no such datum ${datum_id}`);
  }
  return datum;
}

export async function getLatestRevision(
  project_id: ProjectID,
  docid: string
): Promise<string | undefined> {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(docid);
    return doc._rev;
  } catch (err) {
    console.debug(err);
    return undefined;
  }
}

/**
 * Returns a list of not deleted observations
 * @param project_id Project ID to get list of observation for
 * @returns key: observation id, value: observation (NOT NULL)
 */
export async function listObservationMetadata(
  project_id: ProjectID
): Promise<ObservationMetadataList> {
  try {
    const observations = await getAllObservations(project_id);
    const revision_ids: RevisionID[] = [];
    observations.forEach(o => {
      revision_ids.push(o.heads[0]);
    });
    const revisions = await getRevisions(project_id, revision_ids);

    const out: ObservationMetadataList = {};
    observations.forEach((observation, observation_id) => {
      const revision_id = observation.heads[0];
      const revision = revisions[revision_id];
      out[observation_id] = {
        project_id: project_id,
        observation_id: observation_id,
        revision_id: revision_id,
        created: new Date(observation.created),
        created_by: observation.created_by,
        updated: new Date(revision.created),
        updated_by: revision.created_by,
        conflicts: observation.heads.length > 1,
      };
    });
    return out;
  } catch (err) {
    console.warn(err);
    throw Error('failed to get metadata');
  }
}

export async function getDatums(
  project_id: ProjectID,
  datum_ids: DatumID[]
): Promise<DatumMap> {
  const datadb = getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    binary: true, // TODO: work out which format is best for attachments
    keys: datum_ids,
  });
  const rows = res.rows;
  const mapping: DatumMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as Datum;
      mapping[doc._id] = doc;
    }
  });
  return mapping;
}

export async function getRevisions(
  project_id: ProjectID,
  revision_ids: RevisionID[]
): Promise<RevisionMap> {
  const datadb = getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    keys: revision_ids,
  });
  const rows = res.rows;
  const mapping: RevisionMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as Revision;
      mapping[doc._id] = doc;
    }
  });
  return mapping;
}

export async function getObservations(
  project_id: ProjectID,
  observation_ids: ObservationID[]
): Promise<ObservationMap> {
  const datadb = getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    keys: observation_ids,
    conflicts: true,
  });
  const rows = res.rows;
  const mapping: ObservationMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as EncodedObservation;
      mapping[doc._id] = doc;
    }
  });
  return mapping;
}

export async function getAllObservations(
  project_id: ProjectID
): Promise<EncodedObservationMap> {
  const datadb = getDataDB(project_id);
  const res = await datadb.find({
    selector: {
      observation_format_version: 1,
    },
  });
  const observations: EncodedObservationMap = new Map();
  res.docs.map(o => {
    observations.set(o._id, o as EncodedObservation);
  });
  return observations;
}

export async function getFormDataFromRevision(
  project_id: ProjectID,
  revision: Revision
): Promise<{[field_name: string]: any}> {
  const data: {[field_name: string]: any} = {};
  const datum_ids = Object.values(revision.datums);
  const datums = await getDatums(project_id, datum_ids);
  for (const [name, datum_id] of Object.entries(revision.datums)) {
    data[name] = datums[datum_id].data;
  }
  return data;
}

export async function addNewRevisionFromForm(
  project_id: ProjectID,
  observation: Observation,
  new_revision_id: RevisionID
) {
  const datadb = getDataDB(project_id);
  const datum_map = await addNewDatums(
    project_id,
    observation,
    new_revision_id
  );
  const parents =
    observation.revision_id === null ? [] : [observation.revision_id];
  const new_revision: Revision = {
    _id: new_revision_id,
    revision_format_version: 1,
    datums: datum_map,
    observation_id: observation.observation_id,
    parents: parents,
    created: observation.updated.toISOString(),
    created_by: observation.updated_by,
    type: observation.type,
  };
  await datadb.put(new_revision);
}

async function addNewDatums(
  project_id: ProjectID,
  observation: Observation,
  new_revision_id: RevisionID
): Promise<DatumIDMap> {
  const datadb = getDataDB(project_id);
  const datum_map: DatumIDMap = {};
  let revision;
  let data;
  if (observation.revision_id !== null) {
    revision = await getRevision(project_id, observation.revision_id);
    data = await getFormDataFromRevision(project_id, revision);
  } else {
    revision = {};
    data = {};
  }
  for (const [field_name, field_value] of Object.entries(observation.data)) {
    const stored_data = data[field_name];
    if (stored_data === undefined || stored_data !== field_value) {
      const new_datum_id = generateFAIMSDatumID();
      const new_datum = {
        _id: new_datum_id,
        datum_format_version: 1,
        type: '??:??', // TODO: Add type handling
        data: field_value,
        revision_id: new_revision_id,
        observation_id: observation.observation_id,
        annotations: [], // TODO: Add annotation handling
      };
      await datadb.put(new_datum);
      datum_map[field_name] = new_datum_id;
    } else {
      if (revision.datums !== undefined) {
        datum_map[field_name] = revision.datums[field_name];
      } else {
        // This should not happen, as if stored_data === field_value and
        // stored_data is not undefined, then then revision.datums should be
        // defined
        throw Error('something odd happened when saving datums...');
      }
    }
  }
  return datum_map;
}

//function pouchAllDocsToMap(pouch_res: PouchDBAllDocsResult): FAIMSPouchDBMap {
//    const rows = pouch_res.rows;
//    let mapping: FAIMSPouchDBMap = {};
//    rows.forEach(e => {
//        mapping[e.doc._id] = e.doc;
//    });
//    return mapping;
//}
