// Copyright 2026 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  getFieldsForView,
  type FieldVisibilityMap,
  type UiSpecModel,
} from '@faims3/data-model';
import {formDataExtractor} from '../../utils';
import {FormValidation} from '../../validationModule/validation';
import {FaimsFormData} from '../types';
import {completion} from '../utils';

export const DEFAULT_REQUIRED_FIELD_MESSAGE = 'This field is required';

type FieldMetaLike = Record<
  string,
  {isTouched?: boolean; errors?: unknown[]} | undefined
>;

/**
 * Normalise TanStack / Zod field errors to user-facing strings.
 */
export function messagesFromFieldErrors(
  errors: unknown[] | undefined
): string[] {
  if (!errors?.length) return [];
  const out: string[] = [];
  for (const error of errors) {
    if (typeof error === 'string' && error.length > 0) {
      out.push(error);
      continue;
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as {message: unknown}).message === 'string'
    ) {
      const message = (error as {message: string}).message;
      if (message.length > 0) out.push(message);
    }
  }
  return out;
}

function sectionIsVisited(
  sectionId: string,
  fieldMeta: FieldMetaLike,
  uiSpec: UiSpecModel
): boolean {
  return getFieldsForView(uiSpec, sectionId).some(
    fieldName => fieldMeta[fieldName]?.isTouched === true
  );
}

/**
 * Errors to show in the section stepper / "go back" summary.
 *
 * TanStack Form clears `errorMap` when a Field unmounts (leaving a section)
 * while keeping `isTouched`. Re-validate touched fields so those errors
 * survive. Also include incomplete required fields in a visited section so
 * an untouched TakePhoto still prompts the user to go back.
 */
export function collectDisplayedFieldErrors({
  fieldMeta,
  formValues,
  uiSpec,
  formId,
  visibilityMap,
  sections,
}: {
  fieldMeta: FieldMetaLike;
  formValues: FaimsFormData;
  uiSpec: UiSpecModel;
  formId: string;
  visibilityMap: FieldVisibilityMap | undefined;
  sections: string[];
}): Record<string, string[]> {
  const errorMap: Record<string, string[]> = {};

  for (const [fieldName, meta] of Object.entries(fieldMeta)) {
    const messages = messagesFromFieldErrors(meta?.errors);
    if (messages.length > 0) {
      errorMap[fieldName] = messages;
    }
  }

  const extracted = formDataExtractor({fullData: formValues});

  for (const [fieldName, meta] of Object.entries(fieldMeta)) {
    if (!meta?.isTouched || errorMap[fieldName]?.length) continue;
    const result = FormValidation.validateField({
      data: extracted,
      uiSpec,
      fieldId: fieldName,
    });
    if (!result.valid && result.errors?.length) {
      errorMap[fieldName] = result.errors.map(issue => issue.message);
    }
  }

  if (!visibilityMap) {
    return errorMap;
  }

  const progress = completion({
    uiSpec,
    formId,
    data: formValues,
    visibilityMap,
  });

  for (const fieldId of progress.incompleteRequired) {
    if (errorMap[fieldId]?.length) continue;
    const sectionId = sections.find(id =>
      getFieldsForView(uiSpec, id).includes(fieldId)
    );
    if (!sectionId || !sectionIsVisited(sectionId, fieldMeta, uiSpec)) {
      continue;
    }

    const result = FormValidation.validateField({
      data: extracted,
      uiSpec,
      fieldId,
    });
    errorMap[fieldId] =
      !result.valid && result.errors?.length
        ? result.errors.map(issue => issue.message)
        : [DEFAULT_REQUIRED_FIELD_MESSAGE];
  }

  return errorMap;
}
