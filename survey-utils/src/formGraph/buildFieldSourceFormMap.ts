import { getOrderedViewsetIds, getViewsMap, normalizeViewIdList } from '../specParser';
import type { UiSpecification } from '../types';

/** Map each field name to the viewset (form) that contains it. */
export function buildFieldSourceFormMap(spec: UiSpecification): Map<string, string> {
  const map = new Map<string, string>();
  const views = getViewsMap(spec);

  for (const viewsetId of getOrderedViewsetIds(spec)) {
    const viewset = spec.viewsets[viewsetId];
    const viewIds = normalizeViewIdList(viewset?.views);
    if (!viewset || viewIds.length === 0) continue;

    for (const viewId of viewIds) {
      const view = views[viewId];
      if (!view) continue;
      for (const fieldName of view.fields) {
        if (!map.has(fieldName)) {
          map.set(fieldName, viewsetId);
        }
      }
    }
  }

  return map;
}
