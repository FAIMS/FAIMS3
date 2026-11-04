// SPDX-License-Identifier: Apache-2.0

import {afterEach, describe, expect, it} from 'vitest';
import {config} from '../src/buildconfig';
import {
  MEMORY_MONITOR_INTERVAL_MS,
  MEMORY_MONITOR_LOG,
  MemoryMonitor,
  type ProcessMemorySample,
  computeMemoryDiagnostics,
  formatMemoryDiagnostics,
  isMemoryMonitorRunning,
  startMemoryMonitor,
  stopMemoryMonitor,
} from '../src/memoryMonitor';

const MB = 1024 * 1024;

function sample(
  atMs: number,
  overrides: Partial<ProcessMemorySample> = {}
): ProcessMemorySample {
  return {
    atMs,
    rss: 100 * MB,
    heapUsed: 50 * MB,
    heapTotal: 80 * MB,
    external: 8 * MB,
    arrayBuffers: 2 * MB,
    heapSizeLimit: 400 * MB,
    oldSpaceUsed: 30 * MB,
    detachedContexts: 0,
    nativeContexts: 1,
    mallocedMemory: 4 * MB,
    ...overrides,
  };
}

function risingHeap(
  count: number,
  startMs = 0,
  stepMs = 1000
): ProcessMemorySample[] {
  return Array.from({length: count}, (_, i) =>
    sample(startMs + i * stepMs, {
      heapUsed: (50 + i) * MB,
      rss: (100 + i) * MB,
    })
  );
}

describe('computeMemoryDiagnostics', () => {
  it('returns undefined for an empty series', () => {
    expect(computeMemoryDiagnostics([])).toBeUndefined();
  });

  it('reports current usage and vsStart on the first sample', () => {
    const diag = computeMemoryDiagnostics([sample(0)])!;
    expect(diag.rssMb).toBeCloseTo(100);
    expect(diag.heapUsedMb).toBeCloseTo(50);
    expect(diag.heapTotalMb).toBeCloseTo(80);
    expect(diag.heapUtilPct).toBeCloseTo(62.5);
    expect(diag.heapOfLimitPct).toBeCloseTo(12.5);
    expect(diag.externalMb).toBeCloseTo(8);
    expect(diag.arrayBuffersMb).toBeCloseTo(2);
    expect(diag.oldSpaceMb).toBeCloseTo(30);
    expect(diag.heapVsStartPct).toBeCloseTo(0);
    expect(diag.rssVsStartPct).toBeCloseTo(0);
    expect(diag.heapDelta30sPct).toBeNull();
    expect(diag.heapVs10mAvgPct).toBeNull();
    expect(diag.trend).toBe('warming');
    expect(diag.peakHeapMb).toBeCloseTo(50);
    expect(diag.peakRssMb).toBeCloseTo(100);
    expect(diag.peakHeapAgeS).toBe(0);
    expect(diag.hints).toEqual([]);
  });

  it('computes % change over the last 30 seconds', () => {
    const samples = [
      sample(0, {heapUsed: 50 * MB, rss: 100 * MB}),
      sample(30_000, {heapUsed: 60 * MB, rss: 110 * MB}),
    ];
    const diag = computeMemoryDiagnostics(samples)!;
    expect(diag.heapDelta30sPct).toBeCloseTo(20);
    expect(diag.rssDelta30sPct).toBeCloseTo(10);
    expect(diag.heapGrow30sMbPerMin).toBeCloseTo(20);
    expect(diag.rssGrow30sMbPerMin).toBeCloseTo(20);
    expect(diag.trend).toBe('growing');
    expect(diag.uptimeS).toBe(30);
  });

  it('uses the sample at or before the 30s mark', () => {
    const samples = [
      sample(0, {heapUsed: 40 * MB}),
      sample(5_000, {heapUsed: 50 * MB}),
      sample(35_000, {heapUsed: 55 * MB}),
    ];
    const diag = computeMemoryDiagnostics(samples)!;
    // 35s current vs 5s sample (exactly 30s back): +10%
    expect(diag.heapDelta30sPct).toBeCloseTo(10);
  });

  it('treats a small 30s move as stable and a drop as declining', () => {
    expect(
      computeMemoryDiagnostics([
        sample(0, {heapUsed: 50 * MB}),
        sample(30_000, {heapUsed: 50.2 * MB}),
      ])!.trend
    ).toBe('stable');
    expect(
      computeMemoryDiagnostics([
        sample(0, {heapUsed: 50 * MB}),
        sample(30_000, {heapUsed: 48 * MB}),
      ])!.trend
    ).toBe('declining');
  });

  it('reports % above the 10-minute average once enough samples exist', () => {
    const samples = Array.from({length: 30}, (_, i) =>
      sample(i * 1000, {heapUsed: 50 * MB, rss: 100 * MB})
    );
    samples.push(sample(30_000, {heapUsed: 60 * MB, rss: 120 * MB}));
    const diag = computeMemoryDiagnostics(samples)!;
    // 30 samples at 50MB + one at 60MB → avg heap ≈ 50.32MB; current 60 is ~+19%
    expect(diag.heapVs10mAvgPct).toBeGreaterThan(15);
    expect(diag.rssVs10mAvgPct).toBeGreaterThan(15);
  });

  it('tracks peaks and how long ago they occurred', () => {
    const samples = [
      sample(0, {heapUsed: 40 * MB, rss: 90 * MB}),
      sample(10_000, {heapUsed: 80 * MB, rss: 200 * MB}),
      sample(25_000, {heapUsed: 50 * MB, rss: 100 * MB}),
    ];
    const diag = computeMemoryDiagnostics(samples)!;
    expect(diag.peakHeapMb).toBeCloseTo(80);
    expect(diag.peakRssMb).toBeCloseTo(200);
    expect(diag.peakHeapAgeS).toBe(15);
    expect(diag.peakRssAgeS).toBe(15);
  });

  it('counts consecutive heap and rss growth streaks in seconds', () => {
    const diag = computeMemoryDiagnostics(risingHeap(6))!;
    expect(diag.heapGrowStreakS).toBe(5);
    expect(diag.rssGrowStreakS).toBe(5);
  });

  it('resets the growth streak when usage drops', () => {
    const samples = [
      ...risingHeap(4),
      sample(4_000, {heapUsed: 40 * MB, rss: 90 * MB}),
    ];
    const diag = computeMemoryDiagnostics(samples)!;
    expect(diag.heapGrowStreakS).toBe(0);
    expect(diag.rssGrowStreakS).toBe(0);
  });

  it('flags detached contexts, heap-limit, and native-context growth', () => {
    const detached = computeMemoryDiagnostics([
      sample(0, {detachedContexts: 2}),
    ])!;
    expect(detached.hints).toContain('detached-contexts');

    const nearLimit = computeMemoryDiagnostics([
      sample(0, {heapUsed: 340 * MB, heapSizeLimit: 400 * MB}),
    ])!;
    expect(nearLimit.hints).toContain('heap-limit');

    const native = computeMemoryDiagnostics([
      sample(0, {nativeContexts: 1}),
      sample(1000, {nativeContexts: 2}),
    ])!;
    expect(native.hints).toContain('native-contexts');
  });

  it('flags sustained growth once streak and 10m elevation agree', () => {
    const samples = Array.from({length: 40}, (_, i) =>
      sample(i * 1000, {
        heapUsed: (50 + i) * MB,
        rss: (100 + i) * MB,
      })
    );
    const diag = computeMemoryDiagnostics(samples)!;
    expect(diag.heapGrowStreakS).toBeGreaterThanOrEqual(30);
    expect(diag.heapVs10mAvgPct).toBeGreaterThan(10);
    expect(diag.hints).toContain('sustained-growth');
  });

  it('drops samples older than the 10-minute window from the average', () => {
    const samples = [
      sample(0, {heapUsed: 200 * MB, rss: 400 * MB}),
      ...Array.from({length: 30}, (_, i) =>
        sample(10 * 60 * 1000 + i * 1000, {heapUsed: 50 * MB, rss: 100 * MB})
      ),
    ];
    const diag = computeMemoryDiagnostics(samples)!;
    // The 200MB sample is 10+ minutes old and must not lift the average.
    expect(diag.heapVs10mAvgPct).not.toBeNull();
    expect(Math.abs(diag.heapVs10mAvgPct!)).toBeLessThan(1);
  });
});

describe('formatMemoryDiagnostics', () => {
  it('writes a single greppable line with the leak-oriented fields', () => {
    const diag = computeMemoryDiagnostics([
      sample(0, {heapUsed: 50 * MB, rss: 100 * MB}),
      sample(30_000, {heapUsed: 60 * MB, rss: 110 * MB}),
    ])!;
    const line = formatMemoryDiagnostics(diag);
    expect(line.startsWith(MEMORY_MONITOR_LOG)).toBe(true);
    expect(line).toContain('rss=110.0MB');
    expect(line).toContain('heap=60.0/80.0MB');
    expect(line).toContain('+30s=heap+20.0%/rss+10.0%');
    expect(line).toContain('vsStart=heap+20.0%');
    expect(line).toContain('trend=growing');
    expect(line).toContain('detached=0');
    expect(line).toContain('streak=30s');
    expect(line).toContain('grow=20.0MB/min');
  });

  it('appends HINT when leak signals fire', () => {
    const line = formatMemoryDiagnostics(
      computeMemoryDiagnostics([sample(0, {detachedContexts: 1})])!
    );
    expect(line).toContain('HINT=detached-contexts');
  });
});

describe('MemoryMonitor', () => {
  it('logs a started line, then one diagnostic line per tick', () => {
    const lines: string[] = [];
    let now = 0;
    let heap = 50 * MB;
    const monitor = new MemoryMonitor({
      now: () => now,
      collect: () => sample(now, {heapUsed: heap}),
      log: line => lines.push(line),
    });

    const first = monitor.tick();
    expect(first?.trend).toBe('warming');
    now = 30_000;
    heap = 60 * MB;
    const second = monitor.tick();
    expect(second?.heapDelta30sPct).toBeCloseTo(20);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('trend=growing');
  });

  it('trims samples older than 10 minutes', () => {
    let now = 0;
    const monitor = new MemoryMonitor({
      now: () => now,
      collect: () => sample(now, {heapUsed: now === 0 ? 200 * MB : 70 * MB}),
      log: () => undefined,
    });
    monitor.tick();
    now = 11 * 60 * 1000;
    monitor.tick();
    expect(monitor.sampleCount).toBe(1);
    expect(monitor.latest()?.heapUsedMb).toBeCloseTo(70);
  });

  it('start is idempotent and stop clears the timer', () => {
    const lines: string[] = [];
    const monitor = new MemoryMonitor({
      collect: () => sample(Date.now()),
      log: line => lines.push(line),
      intervalMs: 60_000,
    });
    monitor.start();
    monitor.start();
    expect(monitor.running).toBe(true);
    expect(lines.filter(line => line.includes('started'))).toHaveLength(1);
    monitor.stop();
    expect(monitor.running).toBe(false);
    expect(lines.some(line => line.includes('stopped'))).toBe(true);
  });
});

describe('startMemoryMonitor', () => {
  const original = config.memoryMonitorEnabled;

  afterEach(() => {
    stopMemoryMonitor();
    config.memoryMonitorEnabled = original;
  });

  it('is a no-op when the flag is off', () => {
    config.memoryMonitorEnabled = false;
    startMemoryMonitor();
    expect(isMemoryMonitorRunning()).toBe(false);
  });

  it('is a no-op under test even when the flag is on', () => {
    config.memoryMonitorEnabled = true;
    startMemoryMonitor();
    expect(isMemoryMonitorRunning()).toBe(false);
  });
});

describe('config', () => {
  it('exposes memoryMonitorEnabled as a boolean defaulting off', () => {
    expect(typeof config.memoryMonitorEnabled).toBe('boolean');
    expect(config.memoryMonitorEnabled).toBe(false);
  });

  it('uses a 1 second sample interval', () => {
    expect(MEMORY_MONITOR_INTERVAL_MS).toBe(1000);
  });
});
