/**
 * Export pipelines must omit related-record links that point at deleted records
 * (CSV, GeoJSON/KML feature properties, and shared strip helper).
 */
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  buildViewsetFieldSummaries,
  getNotebookFieldTypes,
  HydratedDataRecord,
  HydratedRecord,
  ProjectDataObject,
  ProjectID,
  ProjectUIModel,
} from '@faims3/data-model';
import {expect} from 'chai';
import {processRecordForSpatial} from '../src/couchdb/export/geospatialExport';
import {
  buildExportReadyDataCopy,
  stripDeletedRelatedRefsFromRecordData,
} from '../src/couchdb/export/stripDeletedRelatedRefs';
import {convertDataForOutput} from '../src/couchdb/export/utils';

const VOCAB: [string, string] = ['is related to', 'is related to'];

function fieldMeta() {
  return {
    meta: {
      annotation: {include: false, label: 'annotation'},
      uncertainty: {include: false, label: 'uncertainty'},
    },
  } as const;
}

function testUiSpec(): ProjectUIModel {
  return {
    fields: {
      relF: {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        ...fieldMeta(),
        'component-parameters': {
          label: 'Rel',
          fullWidth: true,
          helperText: '',
          advancedHelperText: '',
          required: false,
          related_type: 'VB',
          relation_type: 'faims-core::Linked',
          multiple: true,
          allowLinkToExisting: true,
          hideCreateAnotherButton: false,
        },
      },
      mapF: {
        'component-namespace': 'mapping-plugin',
        'component-name': 'MapFormField',
        'type-returned': 'faims-core::Json',
        ...fieldMeta(),
        'component-parameters': {
          label: 'Map',
          fullWidth: true,
          helperText: '',
          advancedHelperText: '',
          required: false,
        },
      },
    },
    views: {
      vA: {fields: ['mapF', 'relF']},
      vB: {fields: []},
    },
    viewsets: {
      VA: {
        label: 'Form A',
        views: ['vA'],
      },
      VB: {
        label: 'Form B',
        views: ['vB'],
      },
    },
    visible_types: ['VA', 'VB'],
  };
}

function toHydratedDataRecord(
  h: HydratedRecord,
  projectId: ProjectID
): HydratedDataRecord {
  const data: {[k: string]: unknown} = {};
  const annotations: HydratedDataRecord['annotations'] = {};
  const types: {[k: string]: string} = {};
  for (const [k, v] of Object.entries(h.data)) {
    data[k] = v.data;
    annotations[k] = {
      annotation: v.annotations?.annotation ?? '',
      uncertainty: v.annotations?.uncertainty ?? false,
    };
    types[k] = v.type;
  }
  return {
    project_id: projectId,
    record_id: h.record._id,
    revision_id: h.revision._id,
    created_by: h.record.createdBy,
    updated: new Date(h.revision.created),
    updated_by: h.revision.createdBy,
    deleted: Boolean(h.revision.deleted),
    hrid: h.hrid,
    relationship: undefined,
    data,
    annotations,
    types,
    created: new Date(h.record.created),
    conflicts: Boolean(h.metadata.hadConflict),
    type: h.record.formId,
  };
}

const minimalFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [153.0, -27.0],
      },
      properties: {},
    },
  ],
};

describe('export deleted relationship stripping', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  const projectId = 'proj-export-test';
  let uiSpec: ProjectUIModel;

  beforeEach(() => {
    uiSpec = testUiSpec();
    db = new PouchDB(`export-del-${Date.now()}-${Math.random()}`, {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    engine = new DataEngine({dataDb: db, uiSpec});
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function seedParentWithLinks(
    liveChildId: string,
    deletedChildId: string
  ): Promise<{parentId: string}> {
    const parent = await engine.form.createRecord({
      formId: 'VA',
      createdBy: 'tester',
    });
    await engine.form.updateRevision({
      recordId: parent.record._id,
      revisionId: parent.revision._id,
      mode: 'new',
      updatedBy: 'tester',
      update: {
        mapF: {
          data: minimalFeatureCollection,
        },
        relF: {
          data: [
            {record_id: liveChildId, relation_type_vocabPair: VOCAB},
            {record_id: deletedChildId, relation_type_vocabPair: VOCAB},
          ],
        },
      },
    });
    return {parentId: parent.record._id};
  }

  it('stripDeletedRelatedRefsFromRecordData removes only deleted targets', async () => {
    const live = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    const doomed = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    await engine.deleteRecord({
      recordId: doomed.record._id,
      baseRevisionId: doomed.revision._id,
      userId: 'tester',
    });
    const {parentId} = await seedParentWithLinks(live.record._id, doomed.record._id);

    const parentHydrated = await engine.hydrated.getHydratedRecord({
      recordId: parentId,
    });
    const fields = getNotebookFieldTypes({uiSpecification: uiSpec, viewID: 'VA'});
    const dataCopy = {...toHydratedDataRecord(parentHydrated, projectId).data} as Record<
      string,
      unknown
    >;

    await stripDeletedRelatedRefsFromRecordData({
      fields,
      data: dataCopy,
      dataDb: db,
      uiSpecification: uiSpec,
    });

    expect(dataCopy.relF).to.be.an('array');
    expect((dataCopy.relF as unknown[]).length).to.equal(1);
    expect((dataCopy.relF as {record_id: string}[])[0].record_id).to.equal(
      live.record._id
    );
  });

  it('convertDataForOutput omits deleted relationship ids from CSV-style column', async () => {
    const live = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    const doomed = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    await engine.deleteRecord({
      recordId: doomed.record._id,
      baseRevisionId: doomed.revision._id,
      userId: 'tester',
    });
    const {parentId} = await seedParentWithLinks(live.record._id, doomed.record._id);
    const parentHydrated = await engine.hydrated.getHydratedRecord({
      recordId: parentId,
    });
    const hydratedExport = toHydratedDataRecord(parentHydrated, projectId);
    const fields = getNotebookFieldTypes({uiSpecification: uiSpec, viewID: 'VA'});
    const ready = await buildExportReadyDataCopy({
      viewsetId: 'VA',
      data: hydratedExport.data as Record<string, unknown>,
      viewFieldsMap: buildViewsetFieldSummaries({uiSpecification: uiSpec}),
      dataDb: db as DatabaseInterface<ProjectDataObject>,
      uiSpecification: uiSpec,
    });

    const row = convertDataForOutput(
      fields,
      ready,
      hydratedExport.annotations,
      hydratedExport.hrid ?? hydratedExport.record_id,
      [],
      'VA'
    );

    expect(row.relF).to.be.a('string');
    expect(row.relF).to.include(live.record._id);
    expect(row.relF).to.not.include(doomed.record._id);
  });

  it('buildExportReadyDataCopy leaves non-related fields untouched', async () => {
    const live = await engine.form.createRecord({formId: 'VB', createdBy: 'tester'});
    const {parentId} = await seedParentWithLinks(live.record._id, live.record._id);
    const parentHydrated = await engine.hydrated.getHydratedRecord({recordId: parentId});
    const hydratedExport = toHydratedDataRecord(parentHydrated, projectId);
    const mapBefore = JSON.stringify(hydratedExport.data.mapF);
    const ready = await buildExportReadyDataCopy({
      viewsetId: 'VA',
      data: hydratedExport.data as Record<string, unknown>,
      viewFieldsMap: buildViewsetFieldSummaries({uiSpecification: uiSpec}),
      dataDb: db as DatabaseInterface<ProjectDataObject>,
      uiSpecification: uiSpec,
    });
    expect(JSON.stringify(ready.mapF)).to.equal(mapBefore);
  });

  it('processRecordForSpatial strips deleted links from feature properties (GeoJSON / KML path)', async () => {
    const live = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    const doomed = await engine.form.createRecord({
      formId: 'VB',
      createdBy: 'tester',
    });
    await engine.deleteRecord({
      recordId: doomed.record._id,
      baseRevisionId: doomed.revision._id,
      userId: 'tester',
    });
    const {parentId} = await seedParentWithLinks(live.record._id, doomed.record._id);
    const parentHydrated = await engine.hydrated.getHydratedRecord({
      recordId: parentId,
    });
    const record = toHydratedDataRecord(parentHydrated, projectId);
    const viewFieldsMap = buildViewsetFieldSummaries({uiSpecification: uiSpec});

    const processed = await processRecordForSpatial(
      record,
      viewFieldsMap,
      [],
      db as DatabaseInterface<import('@faims3/data-model').ProjectDataObject>,
      uiSpec
    );

    expect(processed.geometries.length).to.be.greaterThan(0);
    const relSerialized = processed.baseProperties.relF as string;
    expect(relSerialized).to.include(live.record._id);
    expect(relSerialized).to.not.include(doomed.record._id);
  });
});
