import {
  DataEngine,
  getParentFormsForForm,
  ValuesObject,
} from '@faims3/data-model';
import {logWarn} from '../../logging';

/**
 * Resolves the raw field values of this record's parent, for use in templated
 * strings ({{_PARENT.Field-ID}}) and computed expressions ({_PARENT.Field-ID}).
 *
 * Reads the parent relationship from the record's own revision, then loads
 * data from the first parent whose form can parent this record's form -
 * matching the resolution rule of the ParentFieldDisplay field. Values are
 * raw; formatting and typing happen at the point of use. Returns null when
 * there is no parent; resolution failures also return null so callers treat
 * them as no-parent.
 */
export const resolveParentValues = async ({
  engine,
  recordId,
  formId,
}: {
  engine: DataEngine;
  recordId: string;
  formId: string;
}): Promise<ValuesObject | null> => {
  try {
    const own = await engine.hydrated.getHydratedRecord({recordId});
    const parents = own.revision.relationship?.parent ?? [];
    if (parents.length === 0) {
      return null;
    }

    const parentForms = new Set(
      getParentFormsForForm({uiSpecification: engine.uiSpec, formId})
    );

    for (const rel of parents) {
      const parent = await engine.form.getExistingFormData({
        recordId: rel.recordId,
      });
      if (!parentForms.has(parent.formId)) {
        continue;
      }
      // Unwrap {data: ...} entries to raw values.
      const values: ValuesObject = {};
      for (const [k, v] of Object.entries(parent.data)) {
        values[k] = (v as {data?: unknown})?.data;
      }
      return values;
    }
    return null;
  } catch (e) {
    logWarn('resolveParentValues: failed to resolve parent record data', e);
    return null;
  }
};
