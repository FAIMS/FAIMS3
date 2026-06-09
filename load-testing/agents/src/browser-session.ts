import {randomUUID} from 'crypto';
import {chromium, type Browser, type BrowserContext, type CDPSession, type Page} from 'playwright';
import {CoordinatorClient} from '@faims3/load-testing-shared';
import {parseAgentEnv} from './config.js';
import {executeSequencePlan} from './plan-session.js';
import {MetricBuffer} from './metric-buffer.js';
import type {IpcMessage, SessionContext} from './types.js';
import {sessionLog} from './session-log.js';

/** Send an IPC message to the parent worker process. */
function send(msg: IpcMessage): void {
  if (process.send) {
    process.send(msg);
  }
}

/** Bridge PerformanceObserver and custom events to worker IPC metrics. */
async function injectPerformanceBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('faims.')) {
          window.dispatchEvent(
            new CustomEvent('faims:measure', {
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
          new CustomEvent('faims:longtask', {
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
    send({
      type: 'metric',
      payload: {type: 'performance_measure', detail, timestamp: Date.now()},
    });
  });

  await page.exposeFunction('reportLongtask', (detail: unknown) => {
    send({
      type: 'metric',
      payload: {type: 'longtask', detail, timestamp: Date.now()},
    });
  });

  await page.exposeFunction('reportPageLoad', (detail: unknown) => {
    send({
      type: 'metric',
      payload: {type: 'page_load', detail, timestamp: Date.now()},
    });
  });

  await page.addInitScript(() => {
    window.addEventListener('faims:measure', e =>
      (window as unknown as {reportMeasure: (d: unknown) => void}).reportMeasure(
        (e as CustomEvent).detail
      )
    );
    window.addEventListener('faims:longtask', e =>
      (window as unknown as {reportLongtask: (d: unknown) => void}).reportLongtask(
        (e as CustomEvent).detail
      )
    );
    window.addEventListener('faims:page_load', e =>
      (window as unknown as {reportPageLoad: (d: unknown) => void}).reportPageLoad(
        (e as CustomEvent).detail
      )
    );
  });
}

/** Capture CouchDB request timing via CDP Network events. */
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

  // Pair requestWillBeSent with loadingFinished to compute Couch round-trip ms.
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

/** Launch Chromium, run the coordinator-driven plan, and report completion. */
async function runSession(sessionIndex: number): Promise<void> {
  const env = parseAgentEnv();
  const agentId = process.env.AGENT_ID ?? 'agent-0';
  const sessionId = `${agentId}-session-${sessionIndex}-${randomUUID().slice(0, 8)}`;
  const client = new CoordinatorClient(env.COORDINATOR_URL);

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
      slowMo: env.SLOW_MO,
      args: ['--disable-dev-shm-usage'],
    });

    context = await browser.newContext({
      viewport: {width: env.VIEWPORT_WIDTH, height: env.VIEWPORT_HEIGHT},
      userAgent: env.USER_AGENT,
    });

    const page = await context.newPage();
    await injectPerformanceBridge(page);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    setupCouchCapture(cdp, env.COUCH_URL, metricBuffer, sessionId);

    send({type: 'ready', sessionId});
    sessionLog(sessionId, 'browser ready');

    await executeSequencePlan(client, page, context, cdp, metricBuffer, ctx);

    sessionLog(sessionId, 'sequence plan complete');
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
