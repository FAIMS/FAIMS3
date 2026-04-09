import {
  DataDbType,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FieldSummary,
  ProjectUIModel,
  relatedRecordFieldAvpValueSchema,
  relatedRecordSelectorComponentParamsSchema,
  UISpecification,
} from '@faims3/data-model';

import {getComponentKey} from './utils';

/** Couch data DB as returned by {@link getDataDb} or test fakes typed as {@link DataDocument}. */
export type StripRelatedRefsDataDb =
  | DataDbType
  | DatabaseInterface<DataDocument>;

const RELATIONSHIP_COMPONENT = 'faims-custom::RelatedRecordSelector';

const DEFAULT_STRIP_CONFLICT_BEHAVIOUR = 'pickLast' as const;

/**
 * For each related record ID, whether the link should be kept in export.
 * `false` means missing record, unloadable head, or soft-deleted head revision.
 */
async function shouldKeepRelatedRecordLinks(
  engine: DataEngine,
  recordIds: string[]
): Promise<Map<string, boolean>> {
  const keep = new Map<string, boolean>();
  const headByRecord = new Map<string, string>();

  for (const rid of recordIds) {
    try {
      const record = await engine.core.getRecord(rid);
      const {selectedHead} = engine.core.resolveHead({
        recordId: rid,
        heads: record.heads,
        behavior: DEFAULT_STRIP_CONFLICT_BEHAVIOUR,
      });
      headByRecord.set(rid, selectedHead);
    } catch {
      keep.set(rid, false);
    }
  }

  const headIds = [...new Set(headByRecord.values())];
  if (headIds.length === 0) {
    return keep;
  }

  // Batch metadata via `index/revisionMetadata` (no full revision bodies, no AVPs).
  const {revisions} = await engine.query.listRevisionMetadata({
    keys: headIds,
  });
  const deletedByHeadId = new Map(
    revisions.map(r => [r._id, r.deleted === true])
  );

  for (const [rid, headId] of headByRecord) {
    const deleted = deletedByHeadId.get(headId);
    if (deleted === undefined) {
      keep.set(rid, false);
    } else {
      keep.set(rid, !deleted);
    }
  }

  return keep;
}

/**
 * Removes relationship field entries that point at soft-deleted records so
 * tabular/JSON exports do not list those links.
 *
 * Uses {@link DataEngine.core} for record stubs and head resolution, then
 * {@link DataEngine.query.listRevisionMetadata} for `deleted` flags. Full hydration
 * (AVP fetch) is avoided — it was only needed here for `revision.deleted`.
 */
export async function stripDeletedRelatedRefsFromRecordData({
  fields,
  data,
  dataDb,
  uiSpecification,
}: {
  fields: FieldSummary[];
  data: Record<string, unknown>;
  dataDb: StripRelatedRefsDataDb;
  uiSpecification: ProjectUIModel;
}): Promise<void> {
  const engine = new DataEngine({
    dataDb: dataDb as DatabaseInterface<DataDocument>,
    uiSpec: uiSpecification as UISpecification,
  });

  const relatedIds = new Set<string>();
  const relationshipFieldNames: string[] = [];

  for (const field of fields) {
    const key = getComponentKey(field.componentNamespace, field.componentName);
    if (key !== RELATIONSHIP_COMPONENT) {
      continue;
    }
    const fieldName = field.name;
    if (!(fieldName in data)) {
      continue;
    }
    const raw = data[fieldName];
    if (raw == null) {
      continue;
    }

    const valueParsed = relatedRecordFieldAvpValueSchema.safeParse(raw);
    if (!valueParsed.success) {
      continue;
    }
    relationshipFieldNames.push(fieldName);
    const normalized = valueParsed.data;
    const entries = Array.isArray(normalized) ? normalized : [normalized];
    for (const item of entries) {
      relatedIds.add(item.record_id);
    }
  }

  const keepByRecordId = await shouldKeepRelatedRecordLinks(engine, [
    ...relatedIds,
  ]);

  for (const fieldName of relationshipFieldNames) {
    const raw = data[fieldName];
    const fieldDef = uiSpecification.fields[fieldName];
    const paramsParsed = relatedRecordSelectorComponentParamsSchema.safeParse(
      fieldDef?.['component-parameters']
    );
    const multiple = paramsParsed.success
      ? (paramsParsed.data.multiple ?? false)
      : false;

    const valueParsed = relatedRecordFieldAvpValueSchema.safeParse(raw);
    if (!valueParsed.success) {
      continue;
    }
    const normalized = valueParsed.data;
    const entries = Array.isArray(normalized) ? normalized : [normalized];

    const kept: typeof entries = [];
    for (const item of entries) {
      const rid = item.record_id;
      if (keepByRecordId.get(rid) === true) {
        kept.push(item);
      }
    }

    if (multiple) {
      data[fieldName] = kept;
    } else {
      data[fieldName] = kept[0] ?? '';
    }
  }
}

/**
 * Shallow copy of a record's `data` with {@link stripDeletedRelatedRefsFromRecordData}
 * applied for the record's viewset. Used by CSV and spatial exports so properties
 * stay consistent.
 */
export async function buildExportReadyDataCopy({
  viewsetId,
  data,
  viewFieldsMap,
  dataDb,
  uiSpecification,
}: {
  viewsetId: string;
  data: Record<string, unknown>;
  viewFieldsMap: Record<string, FieldSummary[]>;
  dataDb: StripRelatedRefsDataDb;
  uiSpecification: ProjectUIModel;
}): Promise<Record<string, unknown>> {
  const copy: Record<string, unknown> = {...data};
  const fields = viewFieldsMap[viewsetId];
  if (fields?.length) {
    await stripDeletedRelatedRefsFromRecordData({
      fields,
      data: copy,
      dataDb,
      uiSpecification,
    });
  }
  return copy;
}
