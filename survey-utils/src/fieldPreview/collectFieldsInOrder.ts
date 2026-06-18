import { getOrderedViewsetIds, getViewsMap, normalizeViewIdList } from '../specParser';
import type { FieldSpec, UiSpecification } from '../types';

export interface OrderedFieldRef {
  fieldName: string;
  field: FieldSpec;
}

/** Walk forms → sections → fields in the same order as the detailed Word export. */
export function collectFieldsInOrder(spec: UiSpecification): OrderedFieldRef[] {
  const views = getViewsMap(spec);
  const viewsetIds = getOrderedViewsetIds(spec);
  const out: OrderedFieldRef[] = [];
  const seen = new Set<string>();

  for (const viewsetId of viewsetIds) {
    const viewset = spec.viewsets[viewsetId];
    const viewIds = normalizeViewIdList(viewset?.views);
    if (!viewset || viewIds.length === 0) continue;

    for (const viewId of viewIds) {
      const view = views[viewId];
      if (!view) continue;

      for (const fieldName of view.fields) {
        if (seen.has(fieldName)) continue;
        const field = spec.fields[fieldName];
        if (!field) continue;
        seen.add(fieldName);
        out.push({ fieldName, field });
      }
    }
  }

  return out;
}
