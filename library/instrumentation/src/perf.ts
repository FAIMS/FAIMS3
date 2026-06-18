import {FAIMS_PREFIX} from './measures';

/** Session id for correlating marks/measures within one app or test run. */
function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without Web Crypto (tests, older WebViews).
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** True when User Timing mark/measure APIs are available. */
function hasPerformanceApi(): boolean {
  return (
    typeof performance !== 'undefined' &&
    typeof performance.mark === 'function' &&
    typeof performance.measure === 'function'
  );
}

/**
 * Thin wrapper around the User Timing API for FAIMS performance measurement.
 *
 * All entry names are prefixed with {@link FAIMS_PREFIX} (`faims.`). Detail objects
 * automatically include {@link FaimsPerf.sessionId} so load-test agents can group
 * events from the same browser session.
 *
 * Use the exported {@link perf} singleton in application code. Instantiate
 * `FaimsPerf` directly only when you need an isolated session scope.
 */
export class FaimsPerf {
  private readonly prefix = FAIMS_PREFIX;

  /** Stable id for this perf instance; attached to every mark/measure detail. */
  readonly sessionId = randomUUID();

  /**
   * Record a point-in-time mark in the Performance Timeline.
   *
   * @param name Logical measure name (without `faims.` prefix).
   * @param detail Optional metadata merged with `sessionId`.
   */
  mark(name: string, detail: Record<string, unknown> = {}): void {
    if (!hasPerformanceApi()) return;
    performance.mark(`${this.prefix}.${name}`, {
      detail: {...detail, sessionId: this.sessionId},
    } as PerformanceMarkOptions);
  }

  /**
   * Record duration between two previously created marks.
   *
   * @param name Logical measure name for the resulting PerformanceMeasure entry.
   * @param startMark Logical name of the start mark (without prefix).
   * @param endMark Logical name of the end mark; omit to measure until now.
   * @param detail Optional metadata merged with `sessionId`.
   */
  measure(
    name: string,
    startMark: string,
    endMark?: string,
    detail: Record<string, unknown> = {}
  ): void {
    if (!hasPerformanceApi()) return;
    try {
      performance.measure(`${this.prefix}.${name}`, {
        start: `${this.prefix}.${startMark}`,
        end: endMark ? `${this.prefix}.${endMark}` : undefined,
        detail: {...detail, sessionId: this.sessionId},
      } as PerformanceMeasureOptions);
    } catch {
      // Start mark may be missing if the operation was interrupted or never started.
    }
  }

  /**
   * Run an async function between start/end marks and emit a duration measure.
   *
   * Creates marks `${name}.start` and `${name}.end` (or `${name}.error` on failure)
   * and a measure named `name`. Rethrows after recording error marks.
   *
   * @param name Base name for `.start` / `.end` / `.error` marks and the measure.
   * @param fn Async work to time.
   * @param detail Optional metadata copied to all marks/measures in this wrap.
   */
  async wrap<T>(
    name: string,
    fn: () => Promise<T>,
    detail: Record<string, unknown> = {}
  ): Promise<T> {
    this.mark(`${name}.start`, detail);
    try {
      const result = await fn();
      this.mark(`${name}.end`, detail);
      this.measure(name, `${name}.start`, `${name}.end`, detail);
      return result;
    } catch (err) {
      this.mark(`${name}.error`, {
        ...detail,
        error: (err as Error).message,
      });
      this.measure(name, `${name}.start`, `${name}.error`, detail);
      throw err;
    }
  }
}

/** Shared perf instance for the collection app and forms module. */
export const perf = new FaimsPerf();
