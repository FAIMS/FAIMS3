import {describe, expect, test} from 'vitest';
// Populates FIELD_REGISTRY at module load
import './registry';
import {FIELD_REGISTRY} from './registryApi';

describe('field registry completion parity', () => {
  test('no field defines isCompleteFunction', () => {
    const offenders = [...FIELD_REGISTRY.entries()]
      .filter(([, info]) => info.isCompleteFunction !== undefined)
      .map(([key]) => key);
    expect(
      offenders,
      `These field types define isCompleteFunction: ${offenders.join(', ')}. ` +
        'Wire an isCompleteResolver into every computeRecordStatusReport ' +
        'caller before relaxing this test, or form and report completion ' +
        'will diverge.'
    ).toEqual([]);
  });
});
