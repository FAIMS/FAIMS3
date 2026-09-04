import {describe, expect, it} from 'vitest';
import {
  appendExportTimeRangeParams,
  exportTimeRangeError,
  inclusiveFromToExclusiveAfter,
  inclusiveToToExclusiveBefore,
  parseDateTimeLocalMs,
  resolveTimeRangeFieldValues,
} from './export-time-range';

describe('export time range mapping', () => {
  it('maps inclusive From/To minutes to exclusive millisecond bounds', () => {
    const from = '2024-06-01T12:00';
    const to = '2024-06-01T13:00';
    const fromMs = parseDateTimeLocalMs(from)!;
    const toMs = parseDateTimeLocalMs(to)!;
    expect(inclusiveFromToExclusiveAfter(from)).toBe(fromMs - 1);
    expect(inclusiveToToExclusiveBefore(to)).toBe(toMs + 60_000);
  });

  it('allows optional sides and the same minute', () => {
    const same = '2024-06-01T12:00';
    expect(
      exportTimeRangeError({enabled: true, from: same, to: same})
    ).toBeUndefined();
    expect(
      exportTimeRangeError({enabled: true, from: same, to: ''})
    ).toBeUndefined();
    expect(
      exportTimeRangeError({enabled: true, from: '', to: same})
    ).toBeUndefined();
  });

  it('rejects From after To on raw picker instants', () => {
    expect(
      exportTimeRangeError({
        enabled: true,
        from: '2024-06-01T13:00',
        to: '2024-06-01T12:00',
      })
    ).toBe('From must be earlier than To.');
    expect(
      exportTimeRangeError({
        enabled: false,
        from: '2024-06-01T13:00',
        to: '2024-06-01T12:00',
      })
    ).toBeUndefined();
  });

  it('adds no query params when the checkbox is off or both sides are empty', () => {
    const off = new URLSearchParams({format: 'full'});
    appendExportTimeRangeParams(off, {
      enabled: false,
      from: '2024-06-01T12:00',
      to: '2024-06-01T13:00',
    });
    expect(off.has('updatedAfter')).toBe(false);
    expect(off.has('updatedBefore')).toBe(false);

    const empty = new URLSearchParams({format: 'csv'});
    appendExportTimeRangeParams(empty, {enabled: true, from: '', to: ''});
    expect(empty.has('updatedAfter')).toBe(false);
    expect(empty.has('updatedBefore')).toBe(false);
  });

  it('appends only the sides that have values', () => {
    const from = '2024-06-01T12:00';
    const to = '2024-06-01T13:00';
    const fromOnly = new URLSearchParams();
    appendExportTimeRangeParams(fromOnly, {enabled: true, from, to: ''});
    expect(fromOnly.get('updatedAfter')).toBe(
      String(inclusiveFromToExclusiveAfter(from))
    );
    expect(fromOnly.has('updatedBefore')).toBe(false);

    const both = new URLSearchParams();
    appendExportTimeRangeParams(both, {enabled: true, from, to});
    expect(both.get('updatedAfter')).toBe(
      String(inclusiveFromToExclusiveAfter(from))
    );
    expect(both.get('updatedBefore')).toBe(
      String(inclusiveToToExclusiveBefore(to))
    );
  });

  it('resolves enabled from nested state when forms spread the hook result', () => {
    // Regression: useExportTimeRange used to return {state, setters} only.
    // Spreading that onto ExportTimeRangeFields left `enabled` undefined, so
    // ticking the checkbox never revealed From/To.
    expect(
      resolveTimeRangeFieldValues({
        state: {enabled: true, from: '2024-06-01T12:00', to: ''},
      })
    ).toEqual({enabled: true, from: '2024-06-01T12:00', to: ''});
    expect(
      resolveTimeRangeFieldValues({enabled: false, from: '', to: ''})
    ).toEqual({
      enabled: false,
      from: '',
      to: '',
    });
    expect(resolveTimeRangeFieldValues({})).toEqual({
      enabled: false,
      from: '',
      to: '',
    });
  });
});
