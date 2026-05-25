import {DASS_PREFIX} from './measures';

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasPerformanceApi(): boolean {
  return (
    typeof performance !== 'undefined' &&
    typeof performance.mark === 'function' &&
    typeof performance.measure === 'function'
  );
}

export class DassPerf {
  private readonly prefix = DASS_PREFIX;
  readonly sessionId = randomUUID();

  mark(name: string, detail: Record<string, unknown> = {}): void {
    if (!hasPerformanceApi()) return;
    performance.mark(`${this.prefix}.${name}`, {
      detail: {...detail, sessionId: this.sessionId},
    } as PerformanceMarkOptions);
  }

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
      // start mark may not exist if operation was interrupted
    }
  }

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

export const perf = new DassPerf();
