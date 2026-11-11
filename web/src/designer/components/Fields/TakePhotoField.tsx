// SPDX-License-Identifier: Apache-2.0

/**
 * @file Notebook designer configuration for TakePhoto fields.
 *
 * Adds photo-count settings and synchronizes Minimum with Required.
 */

import type {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';
import {ItemCountEditor} from './ItemCountEditor';

/**
 * Default minimum to 1 when Required is checked, preserving existing values.
 * Clear the minimum when Required is unchecked.
 */
const updateRequiredMinimum = (field: FieldType, required: boolean) => {
  const params = field['component-parameters'];
  params.minItems = required ? (params.minItems ?? 1) : null;
};

export const TakePhotoFieldEditor = ({fieldName}: {fieldName: string}) => (
  <BaseFieldEditor
    fieldName={fieldName}
    onRequiredChange={updateRequiredMinimum}
  >
    <ItemCountEditor fieldName={fieldName} itemLabel="Photos" />
  </BaseFieldEditor>
);
