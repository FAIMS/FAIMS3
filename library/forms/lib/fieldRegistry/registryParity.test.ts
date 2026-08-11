import {describe, expect, test} from 'vitest';
// Populates FIELD_REGISTRY at module load
import './registry';
import {FIELD_REGISTRY} from './registryApi';

// Field types whose isCompleteFunction override is a known, accepted
// divergence: computeRecordStatusReport callers that pass no
// isCompleteResolver score these fields with the default rule.
const ALLOWED_OVERRIDES = new Set(['faims-custom::ParentFieldDisplay']);

describe('field registry completion parity', () => {
  test('isCompleteFunction overrides are allowlisted', () => {
    const offenders = [...FIELD_REGISTRY.entries()]
      .filter(([, info]) => info.isCompleteFunction !== undefined)
      .map(([key]) => key)
      .filter(key => !ALLOWED_OVERRIDES.has(key));
    expect(
      offenders,
      `These field types define isCompleteFunction: ${offenders.join(', ')}. ` +
        'Wire an isCompleteResolver into every computeRecordStatusReport ' +
        'caller (or knowingly extend ALLOWED_OVERRIDES), or form and ' +
        'report completion will diverge.'
    ).toEqual([]);
  });
});
