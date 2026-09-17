/**
 * @file Group simple features into planned entries. One source feature is one
 * entry for now; a format or option that groups several features under one
 * entry (say, by a shared attribute) slots in here.
 */
import type {EntryDraft, SimpleFeature} from './types';

export type GroupingStrategy = 'one-per-feature';

export const groupEntries = (
  features: SimpleFeature[],
  strategy: GroupingStrategy = 'one-per-feature'
): EntryDraft[] => {
  switch (strategy) {
    case 'one-per-feature':
    default:
      return features.map(feature => ({
        indices: [feature.index],
        geometries: feature.geometries,
        properties: feature.properties,
      }));
  }
};
