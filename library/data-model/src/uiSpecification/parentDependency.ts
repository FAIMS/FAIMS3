/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: parentDependency.ts
 * Description:
 *   Determines which forms in a uiSpec have fields whose stored values are
 *   derived from a parent record: ParentFieldDisplay fields, templated
 *   strings using {{parent.<Field-ID>}}, and computed fields referencing
 *   parent.<Field-ID>. Used by the API's pre-export refresh pass (#2245) to
 *   decide which forms need their derived values re-derived, and to skip the
 *   pass entirely when no form qualifies.
 */

import {getParentFormsForForm, PARENT_REFERENCE_PREFIX} from './parentForms';
import {CompiledFieldDefinition, UiSpecModel} from './types';

const PARENT_FIELD_DISPLAY_COMPONENT = 'ParentFieldDisplay';
const TEMPLATED_STRING_COMPONENT = 'TemplatedStringField';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches a mustache reference to a parent field, tolerating unescaped forms
// ({{{...}}}, {{&...}}) and whitespace: {{ _PARENT.Field-ID }}
const PARENT_TEMPLATE_REFERENCE = new RegExp(
  `\\{\\{[{&]?\\s*${escapeRegExp(PARENT_REFERENCE_PREFIX)}`
);

/** Why a field's stored value depends on its record's parent. */
export type ParentDependencyKind =
  | 'parent-field-display'
  | 'template'
  | 'expression';

export interface ParentDependentField {
  fieldId: string;
  kind: ParentDependencyKind;
}

/**
 * The parent-dependent fields of a single form, with the parent forms that
 * dependency resolves against. A form with no possible parent form has no
 * parent-dependent fields regardless of its field configuration, since no
 * parent value can ever resolve.
 */
export const getParentDependentFieldsForForm = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: UiSpecModel;
  formId: string;
}): {fields: ParentDependentField[]; parentForms: string[]} => {
  const parentForms = getParentFormsForForm({uiSpecification, formId});
  if (parentForms.length === 0) return {fields: [], parentForms};

  const fields: ParentDependentField[] = [];
  const viewset = uiSpecification.viewsets[formId];
  if (!viewset) return {fields, parentForms};

  for (const viewId of viewset.views) {
    for (const fieldId of uiSpecification.views[viewId]?.fields ?? []) {
      const f = uiSpecification.fields[fieldId];
      if (!f) continue;
      const component = f['component-name'];

      if (component === PARENT_FIELD_DISPLAY_COMPONENT) {
        fields.push({fieldId, kind: 'parent-field-display'});
        continue;
      }

      if (component === TEMPLATED_STRING_COMPONENT) {
        const template = f['component-parameters']?.template;
        if (
          typeof template === 'string' &&
          PARENT_TEMPLATE_REFERENCE.test(template)
        ) {
          fields.push({fieldId, kind: 'template'});
          continue;
        }
      }

      // Compiled uiSpecs carry expressionRefs on computed fields; a parent
      // reference there means the expression reads the parent record.
      const refs = (f as CompiledFieldDefinition).expressionRefs;
      if (refs?.some(ref => ref.startsWith(PARENT_REFERENCE_PREFIX))) {
        fields.push({fieldId, kind: 'expression'});
      }
    }
  }
  return {fields, parentForms};
};

/**
 * All parent-dependent forms in the uiSpec, keyed by form ID. An empty map
 * means the pre-export refresh is a no-op for this notebook.
 */
export const getParentDependentForms = ({
  uiSpecification,
}: {
  uiSpecification: UiSpecModel;
}): Map<string, {fields: ParentDependentField[]; parentForms: string[]}> => {
  const result = new Map<
    string,
    {fields: ParentDependentField[]; parentForms: string[]}
  >();
  for (const formId of Object.keys(uiSpecification.viewsets)) {
    const entry = getParentDependentFieldsForForm({uiSpecification, formId});
    if (entry.fields.length > 0) result.set(formId, entry);
  }
  return result;
};
