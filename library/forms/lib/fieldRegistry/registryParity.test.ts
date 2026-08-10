import {describe, expect, test} from 'vitest';
// Populates FIELD_REGISTRY at module load
import './registry';
import {FIELD_REGISTRY} from './registryApi';

describe('field registry completion parity', () => {
  // The API status route (api/src/api/records.ts) computes record completion
  // without an isCompleteResolver. A field that gains isCompleteFunction must
  // be wired into that route too, or app and API completion will diverge.
  test('no field defines isCompleteFunction', () => {
    const offenders = [...FIELD_REGISTRY.entries()]
      .filter(([, info]) => info.isCompleteFunction !== undefined)
      .map(([key]) => key);
    expect(
      offenders,
      `These field types define isCompleteFunction: ${offenders.join(', ')}. ` +
        'Wire an isCompleteResolver into the API status route ' +
        '(api/src/api/records.ts, computeRecordStatusReport call) before ' +
        'relaxing this test, or app and API completion will diverge.'
    ).toEqual([]);
  });
});
