import {describe, expect, test} from 'vitest';
// Populates FIELD_REGISTRY at module load
import './registry';
import {FIELD_REGISTRY} from './registryApi';

// Accepted divergences: computeRecordStatusReport callers without an
// isCompleteResolver score these fields with the default rule
const ALLOWED_OVERRIDES = new Set(['faims-custom::ParentFieldDisplay']);

describe('field registry completion parity', () => {
  test('isCompleteFunction overrides are allowlisted', () => {
    const offenders = [...FIELD_REGISTRY.entries()]
      .filter(([, info]) => info.isCompleteFunction !== undefined)
      .map(([key]) => key)
      .filter(key => !ALLOWED_OVERRIDES.has(key));
    expect(
      offenders,
      'wire an isCompleteResolver into computeRecordStatusReport callers or extend ALLOWED_OVERRIDES'
    ).toEqual([]);
  });

  test('allowlist entries match a live override', () => {
    const stale = [...ALLOWED_OVERRIDES].filter(
      key => FIELD_REGISTRY.get(key)?.isCompleteFunction === undefined
    );
    expect(stale).toEqual([]);
  });
});
