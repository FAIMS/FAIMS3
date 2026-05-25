import {randomUUID} from 'crypto';
import {chromium, type Browser, type BrowserContext, type CDPSession, type Page} from 'playwright';
import {
  CoordinatorClient,
  Phase,
  parseSharedEnv,
} from '@faims3/load-testing-shared';
import {MetricBuffer} from './metric-buffer.js';
import {runExportStress} from './scenarios/export-stress.js';
import {runOfflineCollection} from './scenarios/offline-collection.js';
import {runOnboarding} from './scenarios/onboarding.js';
import {runSyncStorm} from './scenarios/sync-storm.js';
import type {IpcMessage, SessionContext} from './types.js';
import {sessionLog} from './session-log.js';

const POLL_MS = 3000;

function send(msg: IpcMessage): void {
  if (process.send) {
    process.send(msg);
  }
}

async function injectPerformanceBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('dass.')) {
          window.dispatchEvent(
            new CustomEvent('dass:measure', {
              detail: {
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
                wallClockTime: performance.timeOrigin + entry.startTime,
                detail: (entry as PerformanceEntry & {detail?: unknown}).detail,
              },
            })
          );
        }
      }
    }).observe({entryTypes: ['measure'], buffered: true});

    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.dispatchEvent(
          new CustomEvent('dass:longtask', {
            detail: {
              duration: entry.duration,
              startTime: entry.startTime,
            },
          })
        );
      }
    }).observe({entryTypes: ['longtask']} as PerformanceObserverInit);
  });

  await page.exposeFunction('reportMeasure', (detail: unknown) => {
    send({type: 'metric', payload: {type: 'performance_measure', detail}});
  });

  await page.exposeFunction('reportLongtask', (detail: unknown) => {
    send({type: 'metric', payload: {type: 'longtask', detail}});
  });

  await page.addInitScript(() => {
    window.addEventListener('dass:measure', e =>
      (window as unknown as {reportMeasure: (d: unknown) => void}).reportMeasure(
        (e as CustomEvent).detail
      )
    );
    window.addEventListener('dass:longtask', e =>
      (window as unknown as {reportLongtask: (d: unknown) => void}).reportLongtask(
        (e as CustomEvent).detail
      )
    );
  });
}

function setupCouchCapture(
  cdp: CDPSession,
  couchUrl: string,
  metricBuffer: MetricBuffer,
  sessionId: string
): void {
  const couchHost = new URL(couchUrl).host;
  const pending = new Map<string, {url: string; method: string; timestamp: number}>();

  cdp.on('Network.requestWillBeSent', event => {
    if (event.request.url.includes(couchHost)) {
      pending.set(event.requestId, {
        url: event.request.url,
        method: event.request.method,
        timestamp: event.timestamp,
      });
    }
  });

  cdp.on('Network.loadingFinished', event => {
    const req = pending.get(event.requestId);
    if (req) {
      void metricBuffer.report({
        type: 'couch_request',
        sessionId,
        timestamp: Date.now(),
        url: req.url,
        method: req.method,
        durationMs: (event.timestamp - req.timestamp) * 1000,
        bytes: event.encodedDataLength,
      });
      pending.delete(event.requestId);
    }
  });
}

async function waitForPhase(
  client: CoordinatorClient,
  target: Phase,
  sessionId: string
): Promise<void> {
  sessionLog(sessionId, `waiting for ${target} phase…`);
  while (true) {
    const {phase} = await client.getPhase();
    const order = [
      Phase.WAITING_FOR_AGENTS,
      Phase.ONBOARDING,
      Phase.OFFLINE_COLLECTION,
      Phase.SYNC_STORM,
      Phase.EXPORT_STRESS,
      Phase.COMPLETE,
    ];
    if (order.indexOf(phase) >= order.indexOf(target)) {
      sessionLog(sessionId, `coordinator at ${phase}, starting ${target}`);
      return;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

async function runSession(sessionIndex: number): Promise<void> {
  const env = parseSharedEnv(process.env as Record<string, string>);
  const coordinatorUrl = process.env.COORDINATOR_URL ?? 'http://localhost:4000';
  const agentId = process.env.AGENT_ID ?? 'agent-0';
  const sessionId = `${agentId}-session-${sessionIndex}-${randomUUID().slice(0, 8)}`;
  const client = new CoordinatorClient(coordinatorUrl);

  const ctx: SessionContext = {sessionId, agentId, env};

  const metricBuffer = new MetricBuffer(async report => {
    send({
      type: 'metric',
      payload: {...report, sessionId, agentId},
    });
  });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({
      headless: env.HEADLESS,
      slowMo: parseInt(process.env.SLOW_MO ?? '0', 10) || 0,
    });

    context = await browser.newContext({
      viewport: {width: env.VIEWPORT_WIDTH, height: env.VIEWPORT_HEIGHT},
      userAgent:
        process.env.USER_AGENT ??
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();
    await injectPerformanceBridge(page);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    setupCouchCapture(cdp, env.COUCH_URL, metricBuffer, sessionId);

    send({type: 'ready', sessionId});
    sessionLog(sessionId, 'browser ready');

    await waitForPhase(client, Phase.ONBOARDING, sessionId);
    sessionLog(sessionId, 'starting onboarding');
    const onboarding = await runOnboarding(page, ctx);
    ctx.jwtToken = onboarding.jwtToken;
    sessionLog(sessionId, 'onboarding complete');
    await client.phaseComplete({
      agentId,
      phase: Phase.ONBOARDING,
      sessionCount: 1,
    });
    send({type: 'phase_complete', sessionId, payload: {phase: Phase.ONBOARDING}});

    await waitForPhase(client, Phase.OFFLINE_COLLECTION, sessionId);
    await runOfflineCollection(page, context, cdp, metricBuffer, ctx);

    await waitForPhase(client, Phase.SYNC_STORM, sessionId);
    sessionLog(sessionId, 'starting sync storm');
    await runSyncStorm(page, context, metricBuffer, ctx);
    sessionLog(sessionId, 'sync storm complete');
    await client.phaseComplete({
      agentId,
      phase: Phase.SYNC_STORM,
      sessionCount: 1,
    });
    send({type: 'phase_complete', sessionId, payload: {phase: Phase.SYNC_STORM}});

    await waitForPhase(client, Phase.EXPORT_STRESS, sessionId);
    await runExportStress(metricBuffer, ctx);

    sessionLog(sessionId, 'all phases complete');
    send({type: 'done', sessionId, payload: {success: true}});
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[session ${sessionId}] failed:`, message);
    if (message.includes('Executable doesn\'t exist')) {
      console.error(
        '[session] Playwright browsers missing — run: pnpm --filter=@faims3/load-testing-agents exec playwright install chromium'
      );
    }
    send({
      type: 'error',
      sessionId,
      payload: {message},
    });
    send({type: 'done', sessionId, payload: {success: false}});
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

const sessionIndex = parseInt(process.env.SESSION_INDEX ?? '0', 10);
void runSession(sessionIndex);
