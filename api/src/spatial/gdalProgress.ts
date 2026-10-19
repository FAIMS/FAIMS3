// SPDX-License-Identifier: Apache-2.0
/**
 * Parse GDAL `-progress` / GDALTermProgress output.
 * Classic form: `0...10...20...30...40...50...60...70...80...90...100 - done.`
 * Each `.` is a 2.5% tick. `gdaladdo` may start a new bar after ` - done.`
 */
import type {MapAssetProcessingProgress} from '@faims3/data-model';

const DONE = ' - done.';
const TICKS_PER_BAR = 40;

function percentForTick(tick: number): number {
  return Math.min(100, tick * 2.5);
}

function decadeLabel(tick: number): string {
  return String((tick / 4) * 10);
}

function isDecadeTick(tick: number): boolean {
  return tick % 4 === 0;
}

function isBareZero(buffer: string, index: number): boolean {
  const prev = index === 0 ? undefined : buffer[index - 1];
  return prev === undefined || prev < '0' || prev > '9';
}

/** Index of `0...` (GDALTermProgress), or -1. `0.` in a filename is not a bar. */
function findBarStart(buffer: string, from: number): number {
  for (let i = from; i < buffer.length; i++) {
    if (buffer[i] !== '0' || !isBareZero(buffer, i)) {
      continue;
    }
    if (buffer.startsWith('0...', i)) {
      return i;
    }
  }
  return -1;
}

/** Keep a trailing `0` / `0.` / `0..` that might become `0...` on the next chunk. */
function possibleBarPrefix(tail: string): string {
  if (tail.endsWith('0..') && isBareZero(tail, tail.length - 3)) {
    return '0..';
  }
  if (tail.endsWith('0.') && isBareZero(tail, tail.length - 2)) {
    return '0.';
  }
  if (tail.endsWith('0') && isBareZero(tail, tail.length - 1)) {
    return '0';
  }
  return '';
}

/**
 * Incremental GDALTermProgress reader. `push` returns newly completed
 * percents; `flush` finishes a trailing decade number at end-of-command.
 */
export function createGdalProgressConsumer(): {
  push(chunk: string): number[];
  flush(): number[];
} {
  let buf = '';
  let inBar = false;
  let nextTick = 0;

  const drain = (flush: boolean): number[] => {
    const percents: number[] = [];
    let i = 0;

    const remaining = () => buf.slice(i);

    while (i < buf.length) {
      if (!inBar) {
        const start = findBarStart(buf, i);
        if (start === -1) {
          buf = possibleBarPrefix(remaining());
          return percents;
        }
        i = start;
        inBar = true;
        nextTick = 0;
      }

      if (nextTick > TICKS_PER_BAR) {
        const rest = remaining();
        if (rest.startsWith(DONE)) {
          i += DONE.length;
          inBar = false;
          nextTick = 0;
          continue;
        }
        if (!flush && DONE.startsWith(rest)) {
          break;
        }
        inBar = false;
        nextTick = 0;
        continue;
      }

      const ch = buf[i];
      if (ch === '\r' || ch === '\n' || ch === ' ' || ch === '\t') {
        i += 1;
        continue;
      }

      if (isDecadeTick(nextTick)) {
        const expected = decadeLabel(nextTick);
        const rest = remaining();
        if (rest.startsWith(expected)) {
          const after = i + expected.length;
          const nextCh = buf[after];
          if (nextCh !== undefined && nextCh >= '0' && nextCh <= '9') {
            inBar = false;
            nextTick = 0;
            continue;
          }
          percents.push(percentForTick(nextTick));
          i = after;
          nextTick += 1;
          continue;
        }
        if (!flush && expected.startsWith(rest)) {
          break;
        }
        inBar = false;
        nextTick = 0;
        continue;
      }

      if (ch === '.') {
        percents.push(percentForTick(nextTick));
        i += 1;
        nextTick += 1;
        continue;
      }

      if (!flush) {
        break;
      }
      inBar = false;
      nextTick = 0;
    }

    buf = buf.slice(i);
    return percents;
  };

  return {
    push(chunk: string): number[] {
      buf += chunk;
      return drain(false);
    },
    flush(): number[] {
      const percents = drain(true);
      buf = '';
      inBar = false;
      nextTick = 0;
      return percents;
    },
  };
}

/** Queue `onProgress` writes for one raster GDAL command. */
export function attachGdalProgress(
  onProgress:
    | ((progress: MapAssetProcessingProgress) => void | Promise<void>)
    | undefined,
  phase: string
): {
  onChunk: (chunk: string) => void;
  finish: () => Promise<void>;
} {
  const consumer = createGdalProgressConsumer();
  let progressWait = Promise.resolve();
  const enqueue = (percents: number[]) => {
    for (const percent of percents) {
      const reported: MapAssetProcessingProgress = {phase, percent};
      progressWait = progressWait.then(() =>
        Promise.resolve(onProgress?.(reported))
      );
    }
  };
  return {
    onChunk: (chunk: string) => enqueue(consumer.push(chunk)),
    finish: async () => {
      enqueue(consumer.flush());
      await progressWait;
    },
  };
}
