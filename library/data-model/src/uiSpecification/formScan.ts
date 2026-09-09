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
 * Filename: formScan.ts
 * Description:
 *   Structural helpers for scanning the forms of a ui-spec. A leaf module so
 *   parentForms.ts and relatedForms.ts can both use it without importing
 *   each other.
 */

import {FieldDefinition} from './types';

/** The slice of a ui-spec the form scans read. Structural, so the designer
 * can pass its redux field/view/viewset maps directly. */
export interface ParentScanUiSpec {
  fields: Record<string, FieldDefinition>;
  views: Record<string, {fields: string[]}>;
  viewsets: Record<string, {views: string[]}>;
}

/** Field IDs across all views of a viewset; stale view ids are skipped. Lives
 * here, not in utils.ts, which imports the compile pass. */
export const fieldIdsForViewset = (
  uiSpecification: Pick<ParentScanUiSpec, 'views' | 'viewsets'>,
  viewSetId: string
): string[] => {
  const viewset = uiSpecification.viewsets[viewSetId];
  if (!viewset) return [];
  const ids: string[] = [];
  for (const viewId of viewset.views) {
    ids.push(...(uiSpecification.views[viewId]?.fields ?? []));
  }
  return ids;
};
