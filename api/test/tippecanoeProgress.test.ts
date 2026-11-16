// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  consumeTippecanoeProgress,
  parseTippecanoeProgressLine,
} from '../src/spatial/tippecanoeProgress';

describe('parseTippecanoeProgressLine', () => {
  it('reads JSON phase and 0–100 progress', () => {
    expect(
      parseTippecanoeProgressLine(
        '{"phase":"Reordering geometry","progress":45.2}'
      )
    ).toEqual({phase: 'Reordering geometry', percent: 45.2});
  });

  it('scales JSON progress in 0–1 to percent', () => {
    expect(
      parseTippecanoeProgressLine('{"phase":"z14","progress":0.67}')
    ).toEqual({phase: 'z14', percent: 67});
  });

  it('reads classic colon percent and CR zoom lines', () => {
    expect(parseTippecanoeProgressLine('Reordering geometry: 45%')).toEqual({
      phase: 'Reordering geometry',
      percent: 45,
    });
    expect(parseTippecanoeProgressLine('z14 67.3%  12/34/56')).toEqual({
      phase: 'z14',
      percent: 67.3,
    });
  });

  it('treats Read lines as a phase without percent', () => {
    expect(parseTippecanoeProgressLine('Read 1.23 million features')).toEqual({
      phase: 'Reading',
    });
  });
});

describe('consumeTippecanoeProgress', () => {
  it('splits CR/LF updates and keeps a trailing fragment', () => {
    const first = consumeTippecanoeProgress(
      'Reordering geometry: 10%\rReordering geometry: 20%\rReordering geo'
    );
    expect(first.updates).toEqual([
      {phase: 'Reordering geometry', percent: 10},
      {phase: 'Reordering geometry', percent: 20},
    ]);
    expect(first.leftover).toBe('Reordering geo');
    const flushed = consumeTippecanoeProgress(`${first.leftover}metry: 45%\n`);
    expect(flushed.updates).toEqual([
      {phase: 'Reordering geometry', percent: 45},
    ]);
    expect(flushed.leftover).toBe('');
  });
});
