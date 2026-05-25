import type {MetricReport} from '@faims3/load-testing-shared';

export type MetricSender = (report: MetricReport) => Promise<void>;

export class MetricBuffer {
  private buffer: MetricReport[] = [];
  private online = true;
  private sender: MetricSender;

  constructor(sender: MetricSender) {
    this.sender = sender;
  }

  setOnline(online: boolean): void {
    this.online = online;
    if (online) {
      void this.flush();
    }
  }

  async report(data: MetricReport): Promise<void> {
    const report: MetricReport = {
      ...data,
      timestamp: data.timestamp ?? Date.now(),
    };
    if (this.online) {
      await this.sender(report);
    } else {
      this.buffer.push(report);
    }
  }

  private async flush(): Promise<void> {
    const pending = [...this.buffer];
    this.buffer = [];
    for (const report of pending) {
      await this.sender(report);
    }
  }
}
