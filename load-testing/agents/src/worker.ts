import {fork, type ChildProcess} from 'child_process';
import {randomUUID} from 'crypto';
import {join} from 'path';
import {
  CoordinatorClient,
  parseSharedEnv,
  type MetricReport,
} from '@faims3/load-testing-shared';
import {MetricsClient} from './metrics-client.js';
import type {IpcMessage} from './types.js';

const SESSION_SCRIPT = join(__dirname, 'browser-session.js');

async function main(): Promise<void> {
  const env = parseSharedEnv(process.env as Record<string, string>);
  const coordinatorUrl = process.env.COORDINATOR_URL ?? 'http://localhost:4000';
  const workerId = process.env.WORKER_ID ?? randomUUID();
  const agentId = process.env.AGENT_ID ?? `agent-${workerId.slice(0, 8)}`;
  const sessionsPerAgent = env.SESSIONS_PER_AGENT;

  const client = new CoordinatorClient(coordinatorUrl);
  const metricsClient = new MetricsClient(coordinatorUrl, agentId);

  console.log(`[worker] registering agent ${agentId} with ${sessionsPerAgent} sessions`);

  await client.register({
    agentId,
    workerId,
    sessionCount: sessionsPerAgent,
  });

  const children: ChildProcess[] = [];
  const sessionFinished = new Set<number>();
  let readyCount = 0;
  let doneCount = 0;
  let failedCount = 0;
  let readySent = false;

  const childEnv = {
    ...process.env,
    AGENT_ID: agentId,
    COORDINATOR_URL: coordinatorUrl,
  };

  function maybeFinish(): void {
    if (doneCount < sessionsPerAgent) return;
    if (failedCount > 0) {
      console.error(
        `[worker] ${failedCount}/${sessionsPerAgent} session(s) failed for ${agentId}`
      );
      process.exit(1);
    }
    console.log(`[worker] all sessions complete for ${agentId}`);
    void client
      .agentDone({agentId})
      .then(() => {
        console.log(`[worker] notified coordinator that ${agentId} is done`);
      })
      .catch(err => {
        console.error('[worker] failed to notify coordinator:', err);
      })
      .finally(() => process.exit(0));
  }

  for (let i = 0; i < sessionsPerAgent; i++) {
    const sessionIndex = i;
    const child = fork(SESSION_SCRIPT, [], {
      env: {...childEnv, SESSION_INDEX: String(sessionIndex)},
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    child.on('message', (msg: IpcMessage) => {
      void handleMessage(msg, metricsClient);
      if (msg.type === 'ready') {
        readyCount += 1;
        console.log(
          `[worker] session ${msg.sessionId ?? sessionIndex} ready (${readyCount}/${sessionsPerAgent})`
        );
      }
      if (msg.type === 'phase_complete') {
        const phase = (msg.payload as {phase?: string} | undefined)?.phase ?? '?';
        console.log(
          `[worker] session ${msg.sessionId ?? sessionIndex} finished ${phase}`
        );
      }
      if (msg.type === 'done') {
        sessionFinished.add(sessionIndex);
        doneCount += 1;
        const success =
          (msg.payload as {success?: boolean} | undefined)?.success !== false;
        if (!success) failedCount += 1;
        maybeFinish();
      }
      if (readyCount >= sessionsPerAgent && !readySent) {
        readySent = true;
        console.log(`[worker] notifying coordinator that ${agentId} is ready`);
        void client.ready({agentId}).catch(err => {
          console.error('[worker] failed to notify coordinator:', err);
        });
      }
    });

    child.on('exit', (code, signal) => {
      if (sessionFinished.has(sessionIndex)) return;
      sessionFinished.add(sessionIndex);
      doneCount += 1;
      failedCount += 1;
      console.error(
        `[worker] session ${sessionIndex} exited before completion (code=${code}, signal=${signal})`
      );
      void metricsClient.send({
        type: 'session_error',
        errorType: 'child_crash',
        message: `exit code ${code}, signal ${signal}`,
      });
      maybeFinish();
    });

    children.push(child);
  }

  async function handleMessage(
    msg: IpcMessage,
    metrics: MetricsClient
  ): Promise<void> {
    if (msg.type === 'metric' && msg.payload) {
      const report = msg.payload as MetricReport;
      await metrics.send(report);
    }
    if (msg.type === 'error') {
      const message = String(
        (msg.payload as {message?: string})?.message ?? 'unknown'
      );
      console.error(`[worker] session ${msg.sessionId ?? '?'} error: ${message}`);
      await metricsClient.send({
        type: 'session_error',
        errorType: 'session_error',
        message,
        sessionId: msg.sessionId,
      });
    }
  }

  process.on('SIGTERM', () => {
    for (const child of children) child.kill('SIGTERM');
    process.exit(0);
  });
}

void main().catch(err => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
