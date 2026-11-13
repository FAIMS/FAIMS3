// SPDX-License-Identifier: Apache-2.0
import {mapWithConcurrencyLimit} from '../src/utils';

/** A promise plus the handles to settle it from the test. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

/** Let every already-queued microtask and timer callback run. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('mapWithConcurrencyLimit', () => {
  it('returns results in input order even when later items finish first', async () => {
    const items = [30, 5, 20, 1, 10];
    const results = await mapWithConcurrencyLimit({
      items,
      concurrency: 3,
      mapper: async (ms, index) => {
        await new Promise(resolve => setTimeout(resolve, ms));
        return `${index}:${ms}`;
      },
    });
    expect(results).toEqual(['0:30', '1:5', '2:20', '3:1', '4:10']);
  });

  it('never runs more than `concurrency` mappers at once, and does reach it', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrencyLimit({
      items: Array.from({length: 20}, (_, i) => i),
      concurrency: 4,
      mapper: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await flush();
        inFlight -= 1;
      },
    });
    expect(peak).toBe(4);
  });

  it('runs strictly one at a time, in order, with concurrency 1', async () => {
    const events: string[] = [];
    await mapWithConcurrencyLimit({
      items: ['a', 'b', 'c'],
      concurrency: 1,
      mapper: async item => {
        events.push(`start ${item}`);
        await flush();
        events.push(`end ${item}`);
      },
    });
    expect(events).toEqual([
      'start a',
      'end a',
      'start b',
      'end b',
      'start c',
      'end c',
    ]);
  });

  it.each([0, -3, Number.NaN])(
    'treats concurrency %p as 1',
    async concurrency => {
      let inFlight = 0;
      let peak = 0;
      const results = await mapWithConcurrencyLimit({
        items: [1, 2, 3],
        concurrency,
        mapper: async item => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await flush();
          inFlight -= 1;
          return item * 2;
        },
      });
      expect(results).toEqual([2, 4, 6]);
      expect(peak).toBe(1);
    }
  );

  it('resolves to an empty array without calling the mapper for no items', async () => {
    const mapper = jest.fn();
    await expect(
      mapWithConcurrencyLimit({items: [], concurrency: 4, mapper})
    ).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it('starts nothing new after a failure, but waits for calls already in flight', async () => {
    const gates = [deferred(), deferred()];
    const started: number[] = [];
    const finished: number[] = [];

    let settled = false;
    const run = mapWithConcurrencyLimit({
      items: [0, 1, 2, 3, 4],
      concurrency: 2,
      mapper: async index => {
        started.push(index);
        await gates[index].promise;
        finished.push(index);
      },
    }).finally(() => {
      settled = true;
    });
    // Assert on the rejection up front so it is never unhandled.
    const rejection = expect(run).rejects.toThrow('item 0 failed');

    await flush();
    expect(started).toEqual([0, 1]);

    gates[0].reject(new Error('item 0 failed'));
    await flush();
    // Item 1 is still running: the failure must not be reported yet, and its
    // freed slot must not have picked up item 2.
    expect(settled).toBe(false);
    expect(started).toEqual([0, 1]);

    gates[1].resolve();
    await rejection;
    expect(finished).toEqual([1]);
    expect(started).toEqual([0, 1]);
  });

  it('rejects with the first failure when several calls fail', async () => {
    const gates = [deferred(), deferred()];
    const run = mapWithConcurrencyLimit({
      items: [0, 1],
      concurrency: 2,
      mapper: async index => {
        await gates[index].promise;
      },
    });
    const rejection = expect(run).rejects.toThrow('second item, failed first');

    await flush();
    gates[1].reject(new Error('second item, failed first'));
    await flush();
    gates[0].reject(new Error('first item, failed second'));
    await rejection;
  });
});
