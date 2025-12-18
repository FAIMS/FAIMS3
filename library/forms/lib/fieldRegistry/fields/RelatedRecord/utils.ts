// ============================================================================
// Utility Functions
// ============================================================================

import {RelatedType} from './types';

export function relationTypeToPair(type: RelatedType): [string, string] {
  if (type === 'faims-core::Child') {
    return ['has child', 'is child of'];
  } else {
    return ['is linked to', 'is linked from'];
  }
}
