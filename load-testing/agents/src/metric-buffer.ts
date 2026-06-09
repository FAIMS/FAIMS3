import type {MetricReport} from '@faims3/load-testing-shared';

export type MetricSender = (report: MetricReport) => Promise<void>;

/**
 * Buffers metrics while the browser is offline and flushes on reconnect.
 * Also stamps the current plan step id onto reports.
 */
export class MetricBuffer {
  private buffer: MetricReport[] = [];
  private online = true;
  private currentStepId?: string;
  private sender: MetricSender;

  /** @param sender Async callback that delivers reports (e.g. IPC to worker). */
  constructor(sender: MetricSender) {
    this.sender = sender;
  }

  /** Set the active plan step id for subsequent reports. */
  setStepId(stepId: string): void {
    this.currentStepId = stepId;
  }

  /** Toggle online delivery; flushing buffered reports when going online. */
  setOnline(online: boolean): void {
    this.online = online;
    if (online) {
      void this.flush();
    }
  }

  /** Queue or immediately send a metric depending on connectivity state. */
  async report(data: MetricReport): Promise<void> {
    const report: MetricReport = {
      ...data,
      stepId: data.stepId ?? this.currentStepId,
      timestamp: data.timestamp ?? Date.now(),
    };
    if (this.online) {
      await this.sender(report);
    } else {
      this.buffer.push(report);
    }
  }

  /** Deliver all buffered reports in order. */
  private async flush(): Promise<void> {
    const pending = [...this.buffer];
    this.buffer = [];
    for (const report of pending) {
      await this.sender(report);
    }
  }
}
