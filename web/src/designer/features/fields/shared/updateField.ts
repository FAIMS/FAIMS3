// SPDX-License-Identifier: Apache-2.0

/**
 * @file Small helpers to clone fields and apply updates before `fieldUpdated` dispatches.
 */

import {cloneField} from '../../../domain/notebook/fieldFactory';
import type {FieldType} from '../../../state/initial';

/**
 * Clone-then-mutate pattern for dispatching `fieldUpdated` with minimal boilerplate.
 *
 * @param field - Current field snapshot.
 * @param updater - Synchronous mutator on the clone.
 * @returns New field object to put in the action payload.
 */
export const withUpdatedField = (
  field: FieldType,
  updater: (nextField: FieldType) => void
): FieldType => {
  const nextField = cloneField(field);
  updater(nextField);
  return nextField;
};
