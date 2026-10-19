// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  attachGdalProgress,
  createGdalProgressConsumer,
} from '../src/spatial/gdalProgress';

const FULL_BAR =
  '0...10...20...30...40...50...60...70...80...90...100 - done.\n';
const ALL_TICKS = Array.from({length: 41}, (_, tick) => tick * 2.5);

describe('createGdalProgressConsumer', () => {
  it('reads a classic GDALTermProgress bar including 2.5% dots', () => {
    const consumer = createGdalProgressConsumer();
    expect(consumer.push(FULL_BAR)).toEqual(ALL_TICKS);
    expect(consumer.flush()).toEqual([]);
  });

  it('parses one character at a time', () => {
    const consumer = createGdalProgressConsumer();
    const percents: number[] = [];
    for (const ch of FULL_BAR) {
      percents.push(...consumer.push(ch));
    }
    percents.push(...consumer.flush());
    expect(percents).toEqual(ALL_TICKS);
  });

  it('skips warp preamble and still reads the bar', () => {
    const consumer = createGdalProgressConsumer();
    expect(
      consumer.push('Creating output file that is 1024P x 768L.\n0...10...')
    ).toEqual([0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5]);
  });

  it('does not treat a trailing 10 as 100', () => {
    const consumer = createGdalProgressConsumer();
    expect(consumer.push('0...10')).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(consumer.push('...')).toEqual([12.5, 15, 17.5]);
  });

  it('waits for 100 when the buffer ends at 10 during the last decade', () => {
    const consumer = createGdalProgressConsumer();
    expect(
      consumer.push('0...10...20...30...40...50...60...70...80...90...')
    ).toEqual(ALL_TICKS.slice(0, 40));
    expect(consumer.push('10')).toEqual([]);
    expect(consumer.push('0')).toEqual([100]);
  });

  it('emits 100 when the last decade arrives in one chunk', () => {
    const consumer = createGdalProgressConsumer();
    consumer.push('0...10...20...30...40...50...60...70...80...90...');
    expect(consumer.push('100')).toEqual([100]);
    expect(consumer.flush()).toEqual([]);
  });

  it('starts a second bar after done (gdaladdo overviews)', () => {
    const consumer = createGdalProgressConsumer();
    expect(consumer.push(FULL_BAR + FULL_BAR)).toEqual([
      ...ALL_TICKS,
      ...ALL_TICKS,
    ]);
  });

  it('ignores a filename 0. that is not a progress bar', () => {
    const consumer = createGdalProgressConsumer();
    expect(consumer.push('layer-0.tif ready\n')).toEqual([]);
    expect(consumer.flush()).toEqual([]);
  });

  it('starts a bar only after 0... arrives across chunks', () => {
    const consumer = createGdalProgressConsumer();
    expect(consumer.push('0')).toEqual([]);
    expect(consumer.push('.')).toEqual([]);
    expect(consumer.push('.')).toEqual([]);
    expect(consumer.push('.10')).toEqual([0, 2.5, 5, 7.5, 10]);
  });
});

describe('attachGdalProgress', () => {
  it('reports phase plus percent in order and flushes a trailing decade', async () => {
    const updates: Array<{phase: string; percent: number}> = [];
    const progress = attachGdalProgress(update => {
      updates.push(update);
    }, 'Warping');
    progress.onChunk('Creating output file.\n0...10');
    progress.onChunk('...');
    await progress.finish();
    expect(updates).toEqual([
      {phase: 'Warping', percent: 0},
      {phase: 'Warping', percent: 2.5},
      {phase: 'Warping', percent: 5},
      {phase: 'Warping', percent: 7.5},
      {phase: 'Warping', percent: 10},
      {phase: 'Warping', percent: 12.5},
      {phase: 'Warping', percent: 15},
      {phase: 'Warping', percent: 17.5},
    ]);
  });
});
