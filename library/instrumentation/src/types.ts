import type {FaimsMeasureName} from './measures';

/**
 * Optional metadata attached to performance marks and measures.
 *
 * The instrumentation layer always adds `sessionId` when writing entries.
 * Additional fields (e.g. `recordId`, `error`) are caller-defined.
 */
export interface MeasureDetail {
  /** Correlates marks/measures from one browser session (set by `FaimsPerf`). */
  sessionId?: string;
  /** Human-readable measure name when serialised for load-test reporting. */
  name?: string;
  /** Duration in milliseconds (on completed measures). */
  duration?: number;
  /** High-resolution time origin offset for the measure start. */
  startTime?: number;
  /** Wall-clock timestamp (ms since epoch) for the measure start. */
  wallClockTime?: number;
  /** Caller-supplied fields copied from User Timing `detail`. */
  detail?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Payload shape for `faims:measure` CustomEvents and load-test `performance_measure`
 * metrics forwarded from the browser performance bridge.
 */
export interface PerformanceMeasureEvent {
  /** Measure name as stored in the Performance Timeline (usually `faims.*`). */
  name: FaimsMeasureName | string;
  duration: number;
  startTime: number;
  wallClockTime: number;
  detail?: Record<string, unknown>;
}
