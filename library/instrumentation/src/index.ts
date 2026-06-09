/**
 * @faims3/instrumentation — FAIMS performance instrumentation via the User Timing API.
 *
 * Re-exports the shared `perf` singleton, measure name constants, and types used
 * by the collection app and load-test agents.
 */

export {FaimsPerf, perf} from './perf';
export {FAIMS_MEASURES, FAIMS_PREFIX, faimsMeasureName} from './measures';
export type {FaimsMeasureName} from './measures';
export type {MeasureDetail, PerformanceMeasureEvent} from './types';
