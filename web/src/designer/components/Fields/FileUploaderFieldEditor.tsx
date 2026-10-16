// SPDX-License-Identifier: Apache-2.0

/**
 * @file Notebook designer configuration for FileUploader fields.
 *
 * Reuses the standard field editor and adds attachment-count settings.
 */

import {FieldType} from '@/designer/state/initial';
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

export const FileUploaderFieldEditor = ({fieldName}: {fieldName: string}) => (
  <BaseFieldEditor
    fieldName={fieldName}
    onRequiredChange={updateRequiredMinimum}
  >
    <ItemCountEditor fieldName={fieldName} itemLabel="attachments" />
  </BaseFieldEditor>
);
