import {
  DataEngine,
  FormDataEntry,
  FormRelationshipInstance,
  getViewsForViewSet,
  HydratedRevisionDocument,
  UISpecification,
} from '@faims3/data-model';
import {getFieldInfo} from '../fieldRegistry';
import {FieldVisibilityMap} from './formManagers/types';
import {CompletionResult, FaimsFormData} from './types';

/** Deterministic field name generator for usage for navigations */
export function getFieldId({fieldId}: {fieldId: string}): string {
  return `field-${fieldId}`;
}

/**
 * Represents a hydrated implied parent/linked record for navigation
 */
export interface ImpliedRelationship {
  /** The type of relationship (parent or linked) */
  type: 'parent' | 'linked';
  /** The record ID of the related record */
  recordId: string;
  /** The field ID that defines this relationship */
  fieldId: string;
  /** The human-readable ID of the related record */
  hrid: string;
  /** The form/viewset ID of the related record */
  formId: string;
  /** The display label for the form (from UI spec or fallback to formId) */
  formLabel: string;
}

/**
 * Extracts and hydrates all implied navigation relationships from a revision.
 *
 * This function processes the `relationship` field of a revision document,
 * hydrating each parent and linked record reference to provide full navigation
 * information. Useful for displaying "Go to parent" or "Go to linked record"
 * navigation options when a user arrives at a record without explicit navigation
 * context (e.g., via URL, search, or deep link).
 *
 * @param revision - The hydrated revision document containing relationship data
 * @param engine - The data engine instance for fetching related records
 * @param uiSpec - The UI specification for resolving form labels
 * @returns Promise resolving to an array of hydrated implied relationships
 */
export async function getImpliedNavigationRelationships(
  revision: HydratedRevisionDocument,
  engine: DataEngine,
  uiSpec: UISpecification
): Promise<ImpliedRelationship[]> {
  const results: ImpliedRelationship[] = [];

  /**
   * Helper to hydrate a single relationship instance
   */
  const hydrateRelationship = async (
    rel: FormRelationshipInstance,
    type: 'parent' | 'linked'
  ): Promise<ImpliedRelationship> => {
    const hydrated = await engine.hydrated.getHydratedRecord({
      recordId: rel.recordId,
    });
    const formLabel =
      uiSpec.viewsets[hydrated.record.formId]?.label ?? hydrated.record.formId;

    return {
      type,
      recordId: hydrated.record._id,
      fieldId: rel.fieldId,
      hrid: hydrated.hrid,
      formId: hydrated.record.formId,
      formLabel,
    };
  };

  // Process all parent relationships in parallel
  if (
    revision.relationship?.parent &&
    revision.relationship.parent.length > 0
  ) {
    const parentResults = await Promise.all(
      revision.relationship.parent.map(rel =>
        hydrateRelationship(rel, 'parent')
      )
    );
    results.push(...parentResults);
  }

  // Process all linked relationships in parallel
  if (
    revision.relationship?.linked &&
    revision.relationship.linked.length > 0
  ) {
    const linkedResults = await Promise.all(
      revision.relationship.linked.map(rel =>
        hydrateRelationship(rel, 'linked')
      )
    );
    results.push(...linkedResults);
  }

  return results;
}

function defaultCompletionFunction(formData: FormDataEntry): boolean {
  const {data} = formData;

  // string case
  if (typeof data === 'string') {
    if (data !== null && data !== undefined && data.length > 0) {
      return true;
    }
    return false;
  }

  // other cases, check for non-null/undefined
  if (data !== null && data !== undefined) {
    return true;
  }

  return false;
}

/**
 * calculate completion progress for a form
 *
 * @param uiSpec - The UI specification of the form
 * @param formId - The ID of the form/viewset
 * @param data - The form data entries
 * @param visibilityMap - Map of visible fields per section
 * @returns Float 0->1 representing completion percentage
 */
export function completion({
  uiSpec,
  formId,
  data,
  visibilityMap,
}: {
  uiSpec: UISpecification;
  formId: string;
  data: FaimsFormData;
  visibilityMap: FieldVisibilityMap;
}): CompletionResult {
  let fieldCount = 0;
  let completedCount = 0;

  const allViews = getViewsForViewSet(uiSpec, formId);
  for (const sectionId of allViews) {
    for (const fieldId of visibilityMap[sectionId] ?? []) {
      // Find the field spec
      const fieldSpec = uiSpec.fields[fieldId];
      if (!fieldSpec) {
        continue; // skip unknown fields
      }
      const fieldInfo = getFieldInfo({
        namespace: fieldSpec['component-namespace'],
        name: fieldSpec['component-name'],
      });

      if (!fieldInfo) {
        continue; // skip unknown field info
      }

      // If the field is required, add to count
      if (!fieldSpec['component-parameters']?.required) {
        continue; // skip non-required fields
      }

      // Count
      fieldCount += 1;

      // grab the completion function if defined otherwise use the default
      const completionFunc =
        fieldInfo.fieldInfo.isCompleteFunction ?? defaultCompletionFunction;

      // Get the form data for this field
      const fieldData = data?.[fieldId];
      if (!fieldData) {
        // no data for this field so it's not complete
        continue;
      }

      // Check if the field is complete
      const isComplete = completionFunc(fieldData);
      if (isComplete) {
        completedCount += 1;
      }
    }
  }

  if (fieldCount === 0) {
    // avoid division by zero, consider empty form as complete
    return {
      progress: 1.0,
      requiredCount: 0,
      completedCount: 0,
    };
  }

  return {
    progress: completedCount / fieldCount,
    requiredCount: fieldCount,
    completedCount: completedCount,
  };
}
