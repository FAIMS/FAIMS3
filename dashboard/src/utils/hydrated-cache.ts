import type {DataEngine, HydratedRecord, HydrationResult} from '@faims3/data-model';

const DEBOUNCE_MS = 500;
const HYDRATE_BATCH_SIZE = 25;

/**
 * Resolve a changed doc id (and optional doc) to the record id(s) that need cache invalidation.
 * Record doc _id is the recordId; revision and AVP docs have record_id.
 */
export function recordIdsFromChange(
  id: string,
  doc?: {_id?: string; record_id?: string} | null
): string[] {
  if (id.startsWith('rec-')) return [id];
  if (doc && typeof doc.record_id === 'string') return [doc.record_id];
  return [];
}

export type HydratedRecordCache = {
  getRecords: () => HydratedRecord[];
  getRecord: (recordId: string) => HydratedRecord | undefined;
  invalidate: (recordIds: string[]) => void;
  rehydrate: (recordIds: string[]) => Promise<void>;
  subscribeToChanges: (onUpdate: () => void) => () => void;
  loadInitial: (limit?: number) => Promise<void>;
};

export function createHydratedRecordCache(engine: DataEngine): HydratedRecordCache {
  const cache = new Map<string, HydratedRecord>();
  const order: string[] = []; // insertion order for stable list
  let changeBuffer: Array<{id: string; doc?: unknown}> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let listeners: Array<() => void> = [];

  const notify = () => {
    listeners.forEach(fn => fn());
  };

  const hydrateMultipleBatched = async (recordIds: string[]): Promise<HydrationResult[]> => {
    const unique = [...new Set(recordIds)];
    const results: HydrationResult[] = [];

    for (let i = 0; i < unique.length; i += HYDRATE_BATCH_SIZE) {
      const batch = unique.slice(i, i + HYDRATE_BATCH_SIZE);
      const batchResults = await engine.hydrated.hydrateMultipleRecords(batch, {
        conflictBehaviour: 'pickFirst',
      });
      results.push(...batchResults);
      // Let UI breathe a bit for large sets
      if (unique.length > HYDRATE_BATCH_SIZE) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }

    return results;
  };

  const rehydrate = async (recordIds: string[]) => {
    const unique = [...new Set(recordIds)];
    if (unique.length === 0) return;

    const results: HydrationResult[] = await hydrateMultipleBatched(unique);

    for (const result of results) {
      if (result.success) {
        const record = result.record;
        const recordId = record.record._id;
        if (!cache.has(recordId)) order.push(recordId);
        cache.set(recordId, record);
      } else {
        const recordId = result.recordId;
        cache.delete(recordId);
        const idx = order.indexOf(recordId);
        if (idx !== -1) order.splice(idx, 1);
      }
    }
    notify();
  };

  const flushChangeBuffer = () => {
    if (changeBuffer.length === 0) return;
    const recordIdSet = new Set<string>();
    for (const {id, doc} of changeBuffer) {
      for (const rid of recordIdsFromChange(id, doc as {record_id?: string})) {
        recordIdSet.add(rid);
      }
    }
    changeBuffer = [];
    const ids = [...recordIdSet];
    ids.forEach(rid => cache.delete(rid));
    order.splice(0, order.length, ...order.filter(rid => cache.has(rid)));
    void rehydrate(ids).then(notify);
  };

  type PouchLike = {changes?(opts: {live: boolean; include_docs: boolean; since: string}): {on?(ev: string, fn: (arg: unknown) => void): void; cancel?(): void}};
  const db = (engine as {db: PouchLike}).db;

  return {
    getRecords: () => order.map(id => cache.get(id)).filter((r): r is HydratedRecord => !!r),
    getRecord: (recordId: string) => cache.get(recordId),
    invalidate: (recordIds: string[]) => {
      recordIds.forEach(rid => cache.delete(rid));
      const set = new Set(recordIds);
      for (let i = order.length - 1; i >= 0; i--) {
        if (set.has(order[i])) order.splice(i, 1);
      }
      notify();
    },
    rehydrate,

    subscribeToChanges(onUpdate: () => void) {
      listeners.push(onUpdate);

      if (!db.changes) return () => { listeners = listeners.filter(l => l !== onUpdate); };

      const changesFeed = db.changes({
        live: true,
        include_docs: true,
        since: 'now',
      });

      const onChange = (change: unknown) => {
        const c = change as {id?: string; doc?: unknown};
        changeBuffer.push({id: c.id ?? (c.doc as {_id?: string})?._id ?? '', doc: c.doc});
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          flushChangeBuffer();
        }, DEBOUNCE_MS);
      };

      if (changesFeed.on) {
        changesFeed.on('change', onChange);
        changesFeed.on('error', () => {});
      }

      return () => {
        listeners = listeners.filter(l => l !== onUpdate);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (typeof (changesFeed as {cancel?: () => void}).cancel === 'function') (changesFeed as {cancel: () => void}).cancel();
      };
    },

    async loadInitial(limit = 500) {
      const {records} = await engine.query.getRecords({limit, startKey: undefined});
      const ids = records.map(r => r._id);
      await rehydrate(ids);
      notify();
    },
  };
}
