import type {DassMeasureName} from './measures';

export interface MeasureDetail {
  sessionId?: string;
  name?: string;
  duration?: number;
  startTime?: number;
  wallClockTime?: number;
  detail?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PerformanceMeasureEvent {
  name: DassMeasureName | string;
  duration: number;
  startTime: number;
  wallClockTime: number;
  detail?: Record<string, unknown>;
}
