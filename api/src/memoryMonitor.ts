// SPDX-License-Identifier: Apache-2.0

/**
 * Optional 1 Hz stdout memory sampler for leak hunts.
 *
 * Enabled by `config.memoryMonitorEnabled` (`MEMORY_MONITOR_ENABLED`).
 * Each line is prefixed `[MemoryMonitor]` so it can be grepped independently
 * of HTTP access logs. The timer is `unref`'d so it does not keep the
 * process open.
 */

import {monitorEventLoopDelay, type IntervalHistogram} from 'node:perf_hooks';
import v8 from 'node:v8';
import {config} from './buildconfig';

export const MEMORY_MONITOR_LOG = '[MemoryMonitor]';
export const MEMORY_MONITOR_INTERVAL_MS = 1_000;
export const MEMORY_MONITOR_SHORT_WINDOW_MS = 30_000;
export const MEMORY_MONITOR_LONG_WINDOW_MS = 10 * 60 * 1_000;

const BYTES_PER_MB = 1024 * 1024;
const TREND_GROW_PCT = 1;
const TREND_SHRINK_PCT = -1;
const HINT_HEAP_LIMIT_PCT = 80;
const HINT_VS10M_PCT = 10;
const HINT_STREAK_S = 30;

export type ProcessMemorySample = {
  atMs: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  heapSizeLimit: number;
  oldSpaceUsed: number;
  detachedContexts: number;
  nativeContexts: number;
  mallocedMemory: number;
  eventLoopP50Ms?: number;
  eventLoopP99Ms?: number;
};

export type MemoryTrend = 'growing' | 'stable' | 'declining' | 'warming';

export type MemoryDiagnostics = {
  uptimeS: number;
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  heapUtilPct: number;
  heapOfLimitPct: number;
  externalMb: number;
  arrayBuffersMb: number;
  oldSpaceMb: number;
  mallocedMb: number;
  heapDelta30sPct: number | null;
  rssDelta30sPct: number | null;
  heapVs10mAvgPct: number | null;
  rssVs10mAvgPct: number | null;
  heapVsStartPct: number | null;
  rssVsStartPct: number | null;
  peakHeapMb: number;
  peakRssMb: number;
  peakHeapAgeS: number;
  peakRssAgeS: number;
  heapGrowStreakS: number;
  rssGrowStreakS: number;
  heapGrow30sMbPerMin: number | null;
  rssGrow30sMbPerMin: number | null;
  trend: MemoryTrend;
  detachedContexts: number;
  nativeContexts: number;
  eventLoopP50Ms?: number;
  eventLoopP99Ms?: number;
  hints: string[];
};

export type MemoryMonitorDeps = {
  now?: () => number;
  collect?: () => ProcessMemorySample;
  log?: (line: string) => void;
  intervalMs?: number;
};

/** Convert bytes to megabytes. */
function bytesToMb(bytes: number): number {
  return bytes / BYTES_PER_MB;
}

/** Convert nanoseconds to milliseconds. */
function nsToMs(ns: number): number {
  return ns / 1e6;
}

/** Percent change from `baseline`, or `null` when the baseline is not usable. */
function pctChange(current: number, baseline: number): number | null {
  if (baseline <= 0) {
    return null;
  }
  return ((current - baseline) / baseline) * 100;
}

/** Megabytes-per-minute growth over `windowMs`, or `null` if the window is empty. */
function growMbPerMin(
  currentBytes: number,
  pastBytes: number,
  windowMs: number
): number | null {
  if (windowMs <= 0) {
    return null;
  }
  return ((currentBytes - pastBytes) / BYTES_PER_MB) * (60_000 / windowMs);
}

/** Signed percent for log lines (`+1.2%`, `n/a`). */
function signedPct(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** One-decimal megabyte label for log lines. */
function mb(value: number): string {
  return `${value.toFixed(1)}MB`;
}

/** Arithmetic mean, or `null` for an empty list. */
function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Latest sample at or before `atMs`, else the oldest sample. */
function findSampleAtOrBefore(
  samples: readonly ProcessMemorySample[],
  atMs: number
): ProcessMemorySample | undefined {
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].atMs <= atMs) {
      return samples[i];
    }
  }
  return samples[0];
}

/** V8 old-space used bytes, or 0 when the space is missing. */
function oldSpaceUsedBytes(): number {
  const old = v8
    .getHeapSpaceStatistics()
    .find(space => space.space_name === 'old_space');
  return old?.space_used_size ?? 0;
}

/** One process + V8 heap snapshot, optionally with event-loop delay. */
export function collectProcessMemorySample(
  atMs: number,
  eventLoop?: IntervalHistogram
): ProcessMemorySample {
  const mem = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  return {
    atMs,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    heapSizeLimit: heap.heap_size_limit,
    oldSpaceUsed: oldSpaceUsedBytes(),
    detachedContexts: heap.number_of_detached_contexts,
    nativeContexts: heap.number_of_native_contexts,
    mallocedMemory: heap.malloced_memory,
    eventLoopP50Ms: eventLoop ? nsToMs(eventLoop.percentile(50)) : undefined,
    eventLoopP99Ms: eventLoop ? nsToMs(eventLoop.percentile(99)) : undefined,
  };
}

/**
 * Trends, peaks, and leak hints from a sample ring buffer.
 * Returns `undefined` when there are no samples yet.
 */
export function computeMemoryDiagnostics(
  samples: readonly ProcessMemorySample[]
): MemoryDiagnostics | undefined {
  if (samples.length === 0) {
    return undefined;
  }

  const current = samples[samples.length - 1];
  const first = samples[0];
  const previous = samples.length > 1 ? samples[samples.length - 2] : undefined;
  const spanMs = current.atMs - first.atMs;
  const shortTarget = current.atMs - MEMORY_MONITOR_SHORT_WINDOW_MS;
  const shortSample =
    spanMs >= MEMORY_MONITOR_SHORT_WINDOW_MS
      ? findSampleAtOrBefore(samples, shortTarget)
      : undefined;
  const shortWindowMs = shortSample ? current.atMs - shortSample.atMs : 0;

  const longSamples = samples.filter(
    sample => current.atMs - sample.atMs <= MEMORY_MONITOR_LONG_WINDOW_MS
  );
  const heapAvg10m = mean(longSamples.map(sample => sample.heapUsed));
  const rssAvg10m = mean(longSamples.map(sample => sample.rss));
  const have10m = longSamples.length >= 30;

  let peakHeap = first;
  let peakRss = first;
  for (const sample of samples) {
    if (sample.heapUsed >= peakHeap.heapUsed) {
      peakHeap = sample;
    }
    if (sample.rss >= peakRss.rss) {
      peakRss = sample;
    }
  }

  let heapGrowStreakS = 0;
  let rssGrowStreakS = 0;
  for (let i = samples.length - 1; i > 0; i--) {
    const newer = samples[i];
    const older = samples[i - 1];
    const stepS = Math.max(1, Math.round((newer.atMs - older.atMs) / 1000));
    if (newer.heapUsed > older.heapUsed) {
      heapGrowStreakS += stepS;
    } else {
      break;
    }
  }
  for (let i = samples.length - 1; i > 0; i--) {
    const newer = samples[i];
    const older = samples[i - 1];
    const stepS = Math.max(1, Math.round((newer.atMs - older.atMs) / 1000));
    if (newer.rss > older.rss) {
      rssGrowStreakS += stepS;
    } else {
      break;
    }
  }

  const heapDelta30sPct = shortSample
    ? pctChange(current.heapUsed, shortSample.heapUsed)
    : null;
  const rssDelta30sPct = shortSample
    ? pctChange(current.rss, shortSample.rss)
    : null;

  let trend: MemoryTrend = 'warming';
  if (heapDelta30sPct !== null) {
    if (heapDelta30sPct >= TREND_GROW_PCT) {
      trend = 'growing';
    } else if (heapDelta30sPct <= TREND_SHRINK_PCT) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  const heapOfLimitPct =
    current.heapSizeLimit > 0
      ? (current.heapUsed / current.heapSizeLimit) * 100
      : 0;
  const heapVs10mAvgPct =
    have10m && heapAvg10m !== null
      ? pctChange(current.heapUsed, heapAvg10m)
      : null;
  const rssVs10mAvgPct =
    have10m && rssAvg10m !== null ? pctChange(current.rss, rssAvg10m) : null;

  const hints: string[] = [];
  if (current.detachedContexts > 0) {
    hints.push('detached-contexts');
  }
  if (heapOfLimitPct >= HINT_HEAP_LIMIT_PCT) {
    hints.push('heap-limit');
  }
  if (
    heapGrowStreakS >= HINT_STREAK_S &&
    heapVs10mAvgPct !== null &&
    heapVs10mAvgPct >= HINT_VS10M_PCT
  ) {
    hints.push('sustained-growth');
  }
  if (previous && current.nativeContexts > previous.nativeContexts) {
    hints.push('native-contexts');
  }

  return {
    uptimeS: Math.round(spanMs / 1000),
    rssMb: bytesToMb(current.rss),
    heapUsedMb: bytesToMb(current.heapUsed),
    heapTotalMb: bytesToMb(current.heapTotal),
    heapUtilPct:
      current.heapTotal > 0 ? (current.heapUsed / current.heapTotal) * 100 : 0,
    heapOfLimitPct,
    externalMb: bytesToMb(current.external),
    arrayBuffersMb: bytesToMb(current.arrayBuffers),
    oldSpaceMb: bytesToMb(current.oldSpaceUsed),
    mallocedMb: bytesToMb(current.mallocedMemory),
    heapDelta30sPct,
    rssDelta30sPct,
    heapVs10mAvgPct,
    rssVs10mAvgPct,
    heapVsStartPct: pctChange(current.heapUsed, first.heapUsed),
    rssVsStartPct: pctChange(current.rss, first.rss),
    peakHeapMb: bytesToMb(peakHeap.heapUsed),
    peakRssMb: bytesToMb(peakRss.rss),
    peakHeapAgeS: Math.round((current.atMs - peakHeap.atMs) / 1000),
    peakRssAgeS: Math.round((current.atMs - peakRss.atMs) / 1000),
    heapGrowStreakS,
    rssGrowStreakS,
    heapGrow30sMbPerMin: shortSample
      ? growMbPerMin(current.heapUsed, shortSample.heapUsed, shortWindowMs)
      : null,
    rssGrow30sMbPerMin: shortSample
      ? growMbPerMin(current.rss, shortSample.rss, shortWindowMs)
      : null,
    trend,
    detachedContexts: current.detachedContexts,
    nativeContexts: current.nativeContexts,
    eventLoopP50Ms: current.eventLoopP50Ms,
    eventLoopP99Ms: current.eventLoopP99Ms,
    hints,
  };
}

/** Single `[MemoryMonitor]` stdout line for one diagnostics snapshot. */
export function formatMemoryDiagnostics(diag: MemoryDiagnostics): string {
  const heapUtil = `${diag.heapUsedMb.toFixed(1)}/${diag.heapTotalMb.toFixed(1)}MB`;
  const elag =
    diag.eventLoopP50Ms !== undefined && diag.eventLoopP99Ms !== undefined
      ? ` elag=p50 ${diag.eventLoopP50Ms.toFixed(1)}ms/p99 ${diag.eventLoopP99Ms.toFixed(1)}ms`
      : '';
  const hints = diag.hints.length > 0 ? ` HINT=${diag.hints.join(',')}` : '';
  return (
    `${MEMORY_MONITOR_LOG}` +
    ` rss=${mb(diag.rssMb)}` +
    ` heap=${heapUtil}` +
    ` (${diag.heapUtilPct.toFixed(0)}% heap, ${diag.heapOfLimitPct.toFixed(0)}% limit)` +
    ` old=${mb(diag.oldSpaceMb)}` +
    ` ext=${mb(diag.externalMb)}` +
    ` ab=${mb(diag.arrayBuffersMb)}` +
    ` +30s=heap${signedPct(diag.heapDelta30sPct)}/rss${signedPct(diag.rssDelta30sPct)}` +
    ` vs10m=heap${signedPct(diag.heapVs10mAvgPct)}/rss${signedPct(diag.rssVs10mAvgPct)}` +
    ` vsStart=heap${signedPct(diag.heapVsStartPct)}` +
    ` peak=${mb(diag.peakHeapMb)}/${mb(diag.peakRssMb)}` +
    ` (${diag.peakHeapAgeS}s/${diag.peakRssAgeS}s ago)` +
    ` streak=${diag.heapGrowStreakS}s` +
    ` grow=${diag.heapGrow30sMbPerMin === null ? 'n/a' : `${diag.heapGrow30sMbPerMin.toFixed(1)}MB/min`}` +
    ` trend=${diag.trend}` +
    ` detached=${diag.detachedContexts}` +
    ` native=${diag.nativeContexts}` +
    ` up=${diag.uptimeS}s` +
    elag +
    hints
  );
}

export class MemoryMonitor {
  private readonly now: () => number;
  private readonly collect: () => ProcessMemorySample;
  private readonly log: (line: string) => void;
  private readonly intervalMs: number;
  private readonly injectedCollect: boolean;
  private readonly samples: ProcessMemorySample[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private histogram: IntervalHistogram | undefined;

  constructor(deps: MemoryMonitorDeps = {}) {
    this.now = deps.now ?? Date.now;
    this.injectedCollect = deps.collect !== undefined;
    this.collect = deps.collect ?? (() => this.collectLive());
    this.log = deps.log ?? (line => console.log(line));
    this.intervalMs = deps.intervalMs ?? MEMORY_MONITOR_INTERVAL_MS;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  get running(): boolean {
    return this.timer !== undefined;
  }

  /** Start the 1 Hz sampler. Idempotent; the timer is `unref`'d. */
  start(): void {
    if (this.timer) {
      return;
    }
    if (!this.injectedCollect) {
      this.histogram = monitorEventLoopDelay({resolution: 20});
      this.histogram.enable();
    }
    this.log(
      `${MEMORY_MONITOR_LOG} started interval=${this.intervalMs}ms` +
        ` windows=30s,10m`
    );
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.timer.unref();
  }

  /** Stop the sampler and log peak heap/RSS. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.histogram?.disable();
    this.histogram = undefined;
    const last = this.latest();
    this.log(
      last
        ? `${MEMORY_MONITOR_LOG} stopped samples=${this.samples.length}` +
            ` peakHeap=${mb(last.peakHeapMb)} peakRss=${mb(last.peakRssMb)}`
        : `${MEMORY_MONITOR_LOG} stopped samples=0`
    );
  }

  /** Collect one sample, drop old ones, and log diagnostics. */
  tick(): MemoryDiagnostics | undefined {
    const sample = this.collect();
    this.record(sample);
    if (this.histogram) {
      this.histogram.reset();
    }
    const diag = computeMemoryDiagnostics(this.samples);
    if (diag) {
      this.log(formatMemoryDiagnostics(diag));
    }
    return diag;
  }

  /** Diagnostics from the current ring buffer, without logging. */
  latest(): MemoryDiagnostics | undefined {
    return computeMemoryDiagnostics(this.samples);
  }

  /** Append a sample and drop anything older than the 10-minute window. */
  private record(sample: ProcessMemorySample): void {
    this.samples.push(sample);
    const cutoff = sample.atMs - MEMORY_MONITOR_LONG_WINDOW_MS;
    while (this.samples.length > 1 && this.samples[0].atMs < cutoff) {
      this.samples.shift();
    }
  }

  /** Live process + event-loop sample when no collector was injected. */
  private collectLive(): ProcessMemorySample {
    return collectProcessMemorySample(this.now(), this.histogram);
  }
}

let running: MemoryMonitor | undefined;

/**
 * Start the process-wide sampler. No-op when the flag is off, when already
 * running, or under test (tests construct {@link MemoryMonitor} directly).
 */
export function startMemoryMonitor(): void {
  if (!config.memoryMonitorEnabled || config.runningUnderTest || running) {
    return;
  }
  running = new MemoryMonitor();
  running.start();
}

/** Stop the process-wide sampler. Idempotent. */
export function stopMemoryMonitor(): void {
  if (!running) {
    return;
  }
  running.stop();
  running = undefined;
}

/** Test-only: whether the process-wide sampler is currently running. */
export function isMemoryMonitorRunning(): boolean {
  return running !== undefined;
}
