import {
  completion as computeCompletion,
  DataEngine,
  FormRelationshipInstance,
  HydratedRevisionDocument,
  IsCompleteResolver,
  UiSpecModel,
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
  uiSpec: UiSpecModel
): Promise<ImpliedRelationship[]> {
  const results: ImpliedRelationship[] = [];

  /**
   * Helper to hydrate a single relationship instance
   */
  const hydrateRelationship = async (
    rel: FormRelationshipInstance,
    type: 'parent' | 'linked'
  ): Promise<ImpliedRelationship | null> => {
    const hydrated = await engine.hydrated.getHydratedRecord({
      recordId: rel.recordId,
    });
    if (hydrated.revision.deleted) {
      return null;
    }
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
    results.push(
      ...parentResults.filter((r): r is ImpliedRelationship => r !== null)
    );
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
    results.push(
      ...linkedResults.filter((r): r is ImpliedRelationship => r !== null)
    );
  }

  return results;
}

/**
 * The field registry's per-field-type completeness overrides, for data-model
 * completion callers outside this package (e.g. computeRecordStatusReport), so
 * they score a record exactly as the form progress bar does.
 */
export const fieldCompletionResolver: IsCompleteResolver = ({
  namespace,
  name,
}) => getFieldInfo({namespace, name}).fieldInfo.isCompleteFunction;

/**
 * calculate completion progress for a form
 *
 * Delegates to data-model; the field registry supplies per-field-type
 * completeness overrides.
 *
 * @param uiSpec - The UI specification of the form
 * @param data - The form data entries
 * @param visibilityMap - Map of visible fields per section
 * @returns Progress fraction 0->1, required/completed counts and the required
 *   fields still incomplete
 */
export function completion(args: {
  uiSpec: UiSpecModel;
  data: FaimsFormData;
  visibilityMap: FieldVisibilityMap;
}): CompletionResult {
  return computeCompletion({
    ...args,
    isCompleteResolver: fieldCompletionResolver,
  });
}
