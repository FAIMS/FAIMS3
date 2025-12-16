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

// =============================================================================
// Date/time functions
// =============================================================================

/**
 * Converts a Date to the format required by datetime-local inputs: yyyy-MM-ddTHH:mm:ss
 *
 * HTML datetime-local inputs require this specific format for their value attribute,
 * but we store the value as an ISO string for consistency and timezone handling.
 *
 * @param date - The Date object to convert
 * @returns String in format yyyy-MM-ddTHH:mm:ss suitable for datetime-local input
 */
export const getLocalDateTimeString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Converts a stored ISO string to display format for datetime-local input.
 *
 * @param isoString - ISO format datetime string (e.g., "2024-01-15T10:30:00.000Z")
 * @returns String in format yyyy-MM-ddTHH:mm:ss for input display, or empty string if invalid
 */
export const isoToLocalDisplay = (isoString: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return getLocalDateTimeString(date);
  } catch {
    return '';
  }
};

/**
 * Converts a datetime-local input value to ISO string for storage.
 *
 * @param localValue - Value from datetime-local input (yyyy-MM-ddTHH:mm:ss)
 * @returns ISO format datetime string
 */
export const localDisplayToIso = (localValue: string): string => {
  if (!localValue) return '';
  try {
    const date = new Date(localValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
};
