import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FieldSummary,
  ProjectDataObject,
  ProjectUIModel,
  relatedRecordFieldAvpValueSchema,
  relatedRecordSelectorComponentParamsSchema,
  UISpecification,
} from '@faims3/data-model';

const RELATIONSHIP_COMPONENT = 'faims-custom::RelatedRecordSelector';

function componentKey(namespace: string, name: string): string {
  return namespace ? `${namespace}::${name}` : name;
}

/**
 * Removes relationship field entries that point at soft-deleted records so
 * tabular/JSON exports do not list those links.
 */
export async function stripDeletedRelatedRefsFromRecordData({
  fields,
  data,
  dataDb,
  uiSpecification,
}: {
  fields: FieldSummary[];
  data: Record<string, unknown>;
  dataDb: DatabaseInterface<DataDocument>;
  uiSpecification: ProjectUIModel;
}): Promise<void> {
  const engine = new DataEngine({
    dataDb,
    uiSpec: uiSpecification as UISpecification,
  });

  for (const field of fields) {
    const key = componentKey(field.componentNamespace, field.componentName);
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
      try {
        const h = await engine.hydrated.getHydratedRecord({
          recordId: rid,
          config: {conflictBehaviour: 'pickLast'},
        });
        if (!h.revision.deleted) {
          kept.push(item);
        }
      } catch {
        // missing / unloadable — treat like absent for export
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
  dataDb: DatabaseInterface<ProjectDataObject>;
  uiSpecification: ProjectUIModel;
}): Promise<Record<string, unknown>> {
  const copy: Record<string, unknown> = {...data};
  const fields = viewFieldsMap[viewsetId];
  if (fields?.length) {
    await stripDeletedRelatedRefsFromRecordData({
      fields,
      data: copy,
      dataDb: dataDb as DatabaseInterface<DataDocument>,
      uiSpecification,
    });
  }
  return copy;
}
