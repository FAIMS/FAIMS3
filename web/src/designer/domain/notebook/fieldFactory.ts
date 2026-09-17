// SPDX-License-Identifier: Apache-2.0

/**
 * @file Clone helpers for field specs and designer UUID assignment.
 */

import type {FieldType} from '../../state/initial';

/**
 * Deep-clone a field spec (JSON round-trip).
 *
 * @param field - Source field from the UI spec.
 * @returns Independent copy safe to mutate.
 */
export const cloneField = (field: FieldType): FieldType =>
  JSON.parse(JSON.stringify(field)) as FieldType;

/**
 * Clone and assign a fresh `designerIdentifier` (e.g. after duplicate).
 *
 * @param field - Field to copy.
 * @returns Clone with new UUID.
 */
export const cloneFieldWithDesignerIdentifier = (
  field: FieldType
): FieldType => {
  const cloned = cloneField(field);
  cloned.designerIdentifier = crypto.randomUUID();
  return cloned;
};
