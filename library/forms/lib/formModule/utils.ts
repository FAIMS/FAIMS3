/** Deterministic field name generator for usage for navigations */
export function getFieldId({fieldId}: {fieldId: string}): string {
  return `field-${fieldId}`;
}

import {
  DataEngine,
  FormRelationshipInstance,
  HydratedRevisionDocument,
  UISpecification,
} from '@faims3/data-model';

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
