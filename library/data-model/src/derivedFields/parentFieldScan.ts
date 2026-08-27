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
 * Filename: parentFieldScan.ts
 * Description:
 *   Scans a form's fields for the parent-record fields its templates and
 *   computed expressions reference, so parent resolution can fetch only
 *   those fields.
 */

import {CompiledUiSpecModel, decodeParentRef} from '../uiSpecification';

/** Matches {{_PARENT.Field-ID}} and {{{_PARENT.Field-ID}}} template forms. */
const TEMPLATE_PARENT_REF = /\{\{\{?\s*_PARENT\.([^}\s]+)\s*\}?\}\}/g;

/**
 * Collects the parent field IDs referenced by a form's templated strings and
 * computed expressions. Returns null when the scan cannot be trusted to be
 * complete, so callers fall back to fetching all parent fields.
 */
export function referencedParentFields({
  uiSpecification,
  formId,
}: {
  uiSpecification: CompiledUiSpecModel;
  formId: string;
}): string[] | null {
  const fieldIds = (uiSpecification.viewsets[formId]?.views ?? []).flatMap(
    viewId => uiSpecification.views[viewId]?.fields ?? []
  );
  if (fieldIds.length === 0) {
    return null;
  }
  const found = new Set<string>();
  for (const fieldId of fieldIds) {
    const fieldDetails = uiSpecification.fields[fieldId];
    if (!fieldDetails) {
      // A field the map knows but the spec does not - scan incomplete.
      return null;
    }
    // Computed expressions: compiled references, parent ones decoded.
    for (const ref of fieldDetails.expressionRefs ?? []) {
      const parentField = decodeParentRef(ref);
      if (parentField !== null) {
        found.add(parentField);
      }
    }
    // Templated strings: scan the template text for parent references.
    const template = fieldDetails['component-parameters']?.template;
    if (typeof template === 'string') {
      for (const match of template.matchAll(TEMPLATE_PARENT_REF)) {
        found.add(match[1]);
      }
    }
    // ParentFieldDisplay: the displayed parent field.
    const parentFieldId = fieldDetails['component-parameters']?.parentFieldId;
    if (typeof parentFieldId === 'string' && parentFieldId.length > 0) {
      found.add(parentFieldId);
    }
  }
  return Array.from(found);
}
