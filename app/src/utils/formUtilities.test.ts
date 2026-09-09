import {Record} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {getRecordContextFromRecord} from './formUtilities';

/**
 * Test suite for form utility functions including time stamp and templating logic
 */

describe('getRecordContextFromRecord', () => {
  it('creates context from a valid record', () => {
    const record = {
      created: new Date(1705324200000),
      created_by: 'John Smith',
    } as Record;

    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBe(1705324200000);
    expect(context.createdBy).toBe('John Smith');
  });

  it('handles missing fields gracefully', () => {
    const record = {} as Record;
    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBeUndefined();
    expect(context.createdBy).toBeUndefined();
  });
});
