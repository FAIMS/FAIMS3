// SPDX-License-Identifier: Apache-2.0

/*
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
