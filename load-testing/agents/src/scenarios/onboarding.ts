import {mkdir} from 'fs/promises';
import path from 'path';
import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {sessionLog} from '../session-log.js';
import type {SessionContext} from '../types.js';

export interface OnboardingResult {
  jwtToken?: string;
}

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

// Where the app persists its redux auth slice. See app/src/context/store.tsx:
// the auth reducer is persisted via redux-persist using
// redux-persist-indexeddb-storage (localForage) into the `faims-auth-db`
// database. localForage's default object store is `keyvaluepairs` and
// redux-persist stores the slice under the `persist:<key>` key.
const AUTH_DB_NAME = 'faims-auth-db';
const AUTH_STORE_NAME = 'keyvaluepairs';
const AUTH_PERSIST_KEY = 'persist:auth';

// The projects slice is persisted the same way (redux-persist + localForage),
// in a separate IndexedDB database. We read it to confirm a notebook actually
// finished activating (which creates its local Data DB).
const PROJECTS_DB_NAME = 'faims-projects-db';
const PROJECTS_PERSIST_KEY = 'persist:projects';

interface PageDebugBuffers {
  consoleMessages: string[];
  pageErrors: string[];
}

// Per-page console/page-error buffers so any failing step (via `step`) can dump
// the captured browser console output, not just the explicit auth-return logs.
const pageDebugBuffers = new WeakMap<Page, PageDebugBuffers>();

/**
 * Attaches console + page-error listeners to the page and registers ring
 * buffers so they can be retrieved later (e.g. when a step fails).
 */
function attachConsoleCapture(page: Page): PageDebugBuffers {
  const existing = pageDebugBuffers.get(page);
  if (existing) return existing;

  const buffers: PageDebugBuffers = {consoleMessages: [], pageErrors: []};
  page.on('console', msg => {
    buffers.consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    if (buffers.consoleMessages.length > 200) buffers.consoleMessages.shift();
  });
  page.on('pageerror', err => {
    buffers.pageErrors.push(err.stack ?? err.message);
    if (buffers.pageErrors.length > 200) buffers.pageErrors.shift();
  });

  pageDebugBuffers.set(page, buffers);
  return buffers;
}

function getDebugBuffers(page: Page): PageDebugBuffers {
  return pageDebugBuffers.get(page) ?? {consoleMessages: [], pageErrors: []};
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

async function captureFailureScreenshot(
  page: Page,
  sessionId: string,
  stepName: string
): Promise<string | undefined> {
  try {
    await mkdir(SCREENSHOT_DIR, {recursive: true});
    const file = path.join(
      SCREENSHOT_DIR,
      `${sanitize(sessionId)}-${sanitize(stepName)}-${Date.now()}.png`
    );
    await page.screenshot({path: file, fullPage: true});
    return file;
  } catch (screenshotErr) {
    sessionLog(
      sessionId,
      `failed to capture screenshot for step "${stepName}": ${
        (screenshotErr as Error).message
      }`
    );
    return undefined;
  }
}

async function step<T>(
  page: Page,
  ctx: SessionContext,
  stepName: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const screenshotPath = await captureFailureScreenshot(
      page,
      ctx.sessionId,
      stepName
    );
    // Dump the full browser state (URL, auth slice, console output, page
    // errors) so failures like the generic error fallback can be diagnosed
    // from the logs alone.
    await logBrowserState(page, ctx, `failure:${stepName}`);
    const original = (err as Error).message;
    const error = new Error(
      `onboarding step "${stepName}" failed: ${original}` +
        (screenshotPath ? ` (screenshot: ${screenshotPath})` : '')
    );
    error.stack = (err as Error).stack;
    sessionLog(
      ctx.sessionId,
      `step "${stepName}" failed${
        screenshotPath ? ` - screenshot saved to ${screenshotPath}` : ''
      }`
    );
    throw error;
  }
}

interface PersistedAuthSummary {
  hasActiveUser: boolean;
  isAuthenticated?: boolean;
  activeUsername?: string;
  activeServerId?: string;
  tokenPresent: boolean;
  tokenExpiresAt?: number;
  serverIds: string[];
  token?: string;
}

interface RawBrowserState {
  url: string;
  title: string;
  bodyTextSnippet: string;
  localStorageKeys: string[];
  indexedDbDatabases: string[];
  persistAuthRaw: string | null;
}

/**
 * Reads the live browser/auth state from inside the page. The redux auth slice
 * is persisted to IndexedDB (not localStorage), so we open it directly here.
 */
async function readRawBrowserState(page: Page): Promise<RawBrowserState> {
  return page.evaluate(
    async ({dbName, storeName, persistKey}) => {
      const readPersistedAuth = (): Promise<string | null> =>
        new Promise(resolve => {
          let req: IDBOpenDBRequest;
          try {
            req = indexedDB.open(dbName);
          } catch {
            resolve(null);
            return;
          }
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(storeName)) {
              resolve(null);
              return;
            }
            try {
              const tx = db.transaction(storeName, 'readonly');
              const getReq = tx.objectStore(storeName).get(persistKey);
              getReq.onsuccess = () => {
                const v = getReq.result;
                resolve(typeof v === 'string' ? v : v == null ? null : JSON.stringify(v));
              };
              getReq.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });

      let indexedDbDatabases: string[] = [];
      try {
        if (typeof indexedDB.databases === 'function') {
          const dbs = await indexedDB.databases();
          indexedDbDatabases = dbs
            .map(d => d.name ?? '')
            .filter(name => name.length > 0);
        }
      } catch {
        indexedDbDatabases = [];
      }

      return {
        url: window.location.href,
        title: document.title,
        bodyTextSnippet: (document.body?.innerText ?? '').slice(0, 600),
        localStorageKeys: Object.keys(window.localStorage),
        indexedDbDatabases,
        persistAuthRaw: await readPersistedAuth(),
      };
    },
    {
      dbName: AUTH_DB_NAME,
      storeName: AUTH_STORE_NAME,
      persistKey: AUTH_PERSIST_KEY,
    }
  );
}

/**
 * Reads a single redux-persist entry (e.g. `persist:projects`) from an
 * IndexedDB database created by redux-persist-indexeddb-storage / localForage.
 */
async function readPersistRaw(
  page: Page,
  dbName: string,
  persistKey: string
): Promise<string | null> {
  return page.evaluate(
    ({dbName, storeName, persistKey}) =>
      new Promise<string | null>(resolve => {
        let req: IDBOpenDBRequest;
        try {
          req = indexedDB.open(dbName);
        } catch {
          resolve(null);
          return;
        }
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            resolve(null);
            return;
          }
          try {
            const tx = db.transaction(storeName, 'readonly');
            const getReq = tx.objectStore(storeName).get(persistKey);
            getReq.onsuccess = () => {
              const v = getReq.result;
              resolve(
                typeof v === 'string' ? v : v == null ? null : JSON.stringify(v)
              );
            };
            getReq.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      }),
    {dbName, storeName: AUTH_STORE_NAME, persistKey}
  );
}

interface ProjectActivation {
  exists: boolean;
  isActivated: boolean;
  hasDatabase: boolean;
}

/**
 * Extracts the activation state of a single project from the persisted projects
 * slice. Returns `exists: false` when the project isn't in the store at all.
 */
function parseProjectActivation(
  raw: string | null,
  serverId: string,
  projectId: string
): ProjectActivation {
  const missing: ProjectActivation = {
    exists: false,
    isActivated: false,
    hasDatabase: false,
  };
  if (!raw) return missing;
  try {
    const outer = JSON.parse(raw) as Record<string, string>;
    const servers = outer.servers
      ? (JSON.parse(outer.servers) as Record<
          string,
          {projects?: Record<string, {isActivated?: boolean; database?: unknown}>}
        >)
      : {};
    const project = servers[serverId]?.projects?.[projectId];
    if (!project) return missing;
    return {
      exists: true,
      isActivated: !!project.isActivated,
      hasDatabase: !!project.database,
    };
  } catch {
    return missing;
  }
}

/**
 * redux-persist stores the slice as an object whose top-level values are each
 * individually JSON-stringified, so we parse twice to extract the auth state.
 */
function parsePersistedAuth(raw: string | null): PersistedAuthSummary | undefined {
  if (!raw) return undefined;
  try {
    const outer = JSON.parse(raw) as Record<string, string>;
    const parseField = <T,>(key: string): T | undefined => {
      const value = outer[key];
      return value == null ? undefined : (JSON.parse(value) as T);
    };

    const activeUser = parseField<{
      username?: string;
      serverId?: string;
      token?: string;
      expiresAt?: number;
    }>('activeUser');
    const servers = parseField<Record<string, unknown>>('servers') ?? {};
    const isAuthenticated = parseField<boolean>('isAuthenticated');

    return {
      hasActiveUser: !!activeUser,
      isAuthenticated,
      activeUsername: activeUser?.username,
      activeServerId: activeUser?.serverId,
      tokenPresent: !!activeUser?.token,
      tokenExpiresAt: activeUser?.expiresAt,
      serverIds: Object.keys(servers),
      token: activeUser?.token,
    };
  } catch {
    return undefined;
  }
}

/**
 * Dumps the current browser + auth state to the session log. Useful for
 * diagnosing why the app is still showing the login screen after a successful
 * redirect back to /auth-return.
 */
async function logBrowserState(
  page: Page,
  ctx: SessionContext,
  label: string
): Promise<PersistedAuthSummary | undefined> {
  const {consoleMessages, pageErrors} = getDebugBuffers(page);

  let raw: RawBrowserState | undefined;
  try {
    raw = await readRawBrowserState(page);
  } catch (err) {
    sessionLog(
      ctx.sessionId,
      `[debug:${label}] failed to read browser state: ${
        (err as Error).message
      }\nrecentConsole:\n${consoleMessages.slice(-30).join('\n')}\npageErrors:\n${pageErrors.slice(-30).join('\n')}`
    );
    return undefined;
  }

  const auth = parsePersistedAuth(raw.persistAuthRaw);
  const debug = {
    url: raw.url,
    title: raw.title,
    localStorageKeys: raw.localStorageKeys,
    indexedDbDatabases: raw.indexedDbDatabases,
    auth: auth
      ? {
          hasActiveUser: auth.hasActiveUser,
          isAuthenticated: auth.isAuthenticated,
          activeUsername: auth.activeUsername,
          activeServerId: auth.activeServerId,
          tokenPresent: auth.tokenPresent,
          tokenExpiresAt: auth.tokenExpiresAt,
          knownServerIds: auth.serverIds,
        }
      : 'no persisted auth slice found',
    recentConsole: consoleMessages.slice(-30),
    pageErrors: pageErrors.slice(-30),
    bodyTextSnippet: raw.bodyTextSnippet,
  };

  sessionLog(
    ctx.sessionId,
    `[debug:${label}] browser state:\n${JSON.stringify(debug, null, 2)}`
  );

  return auth;
}

export async function runOnboarding(
  page: Page,
  ctx: SessionContext
): Promise<OnboardingResult> {
  const {env} = ctx;
  const email = `loadtest+${ctx.sessionId}@example.com`;
  const password = 'LoadTestPass123!';
  const registerUrl = new URL('/register', env.DASS_API_URL);
  registerUrl.searchParams.set('inviteId', env.INVITE_CODE);
  registerUrl.searchParams.set('redirect', `${env.DASS_APP_URL}/auth-return`);

  // Capture browser console + page errors so we can see what the app logs while
  // it attempts to exchange the token and log in. Registered against the page
  // so every step's failure handler can dump them too.
  attachConsoleCapture(page);

  const start = Date.now();

  await step(page, ctx, 'register', async () => {
    sessionLog(ctx.sessionId, `registering user at ${registerUrl.origin}`);
    await page.goto(registerUrl.toString(), {waitUntil: 'domcontentloaded'});

    const emailInput = page.locator('#EmailInput, input[name="email"]');
    if (await emailInput.count()) {
      await emailInput.fill(email);
      await page
        .locator('#NameInput, input[name="name"]')
        .fill(`Load Test ${ctx.sessionId}`);
      await page
        .locator('#InputPassword, input[name="password"]')
        .fill(password);
      await page.locator('#RepeatPassword, input[name="repeat"]').fill(password);
      await page
        .locator('button[type="submit"], input[type="submit"]')
        .first()
        .click();
    }
  });

  await step(page, ctx, 'await-auth-return', async () => {
    await page.waitForURL(/auth-return|localhost:3000/, {timeout: 120000});
    sessionLog(
      ctx.sessionId,
      `registration submitted, landed on ${page.url()}`
    );

    // The /auth-return route runs an async token exchange and then redirects.
    // Log the state right as we arrive, then again after giving the exchange a
    // moment to complete, so we can see whether the app actually authenticates.
    await logBrowserState(page, ctx, 'auth-return:arrived');

    await page.waitForTimeout(5000);

    const auth = await logBrowserState(page, ctx, 'auth-return:after-exchange');

    if (!auth?.tokenPresent) {
      sessionLog(
        ctx.sessionId,
        '[debug:auth-return] WARNING: no active-user token found in persisted ' +
          'auth state after exchange window - the app likely failed to log in ' +
          '(check pageErrors / recentConsole above, e.g. unknown server listing ' +
          'or failed token exchange).'
      );
    }
  });

  const loadMs = Date.now() - start;
  await step(page, ctx, 'report-page-load', async () => {
    await page.evaluate(
      ({ms, pageName}) => {
        window.dispatchEvent(
          new CustomEvent('dass:page_load', {
            detail: {name: pageName, durationMs: ms},
          })
        );
      },
      {ms: loadMs, pageName: 'onboarding'}
    );
  });

  await step(page, ctx, 'open-app', async () => {
    // Avoid 'networkidle' - live sync can keep the network busy indefinitely.
    await page.goto(env.DASS_APP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  });

  await step(page, ctx, 'activate-notebook', async () => {
    const serverId = env.NOTEBOOK_SERVER_ID;
    const projectId = env.NOTEBOOK_PROJECT_ID;

    const readActivation = async (): Promise<ProjectActivation> =>
      parseProjectActivation(
        await readPersistRaw(page, PROJECTS_DB_NAME, PROJECTS_PERSIST_KEY),
        serverId,
        projectId
      );

    // Already activated (with a local DB)? Nothing to do.
    const initial = await readActivation();
    if (initial.isActivated && initial.hasDatabase) {
      sessionLog(ctx.sessionId, 'notebook already activated, skipping');
      return;
    }

    // Make sure we're on the workspace/home page where the notebook list lives.
    // Avoid 'networkidle' - live sync can keep the network busy indefinitely;
    // readiness is asserted by waiting for the "Not Active" tab below.
    await page.goto(env.DASS_APP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Open the "Not Active" tab - un-activated notebooks only show there.
    const notActiveTab = page.getByRole('tab', {name: /not active/i});
    await notActiveTab.waitFor({timeout: 30000});
    await notActiveTab.click();

    // The notebook list is a MUI DataGrid; each row's data-id is its projectId.
    // Target our notebook's row specifically, falling back to the first row if
    // we can't match it (e.g. only one notebook is present).
    const row = page.locator(`[role="row"][data-id="${projectId}"]`);
    const activateButton = (await row.count())
      ? row.getByTestId('notebook-activate-button')
      : page.getByTestId('notebook-activate-button').first();

    if (!(await row.count())) {
      sessionLog(
        ctx.sessionId,
        `notebook row ${projectId} not found in list, using first activate button`
      );
    }

    await activateButton.waitFor({timeout: 30000});
    sessionLog(ctx.sessionId, `activating notebook ${projectId}`);
    await activateButton.click();

    // Confirm activation in the dialog.
    const confirmBtn = page.getByTestId('notebook-activate-confirm');
    await confirmBtn.waitFor({timeout: 15000});
    await confirmBtn.click();

    // Activation downloads records and creates the local Data DB. Wait until the
    // persisted projects slice reflects that, otherwise opening the notebook
    // crashes with "Could not get Data DB for project".
    const deadline = Date.now() + 60000;
    let activation = await readActivation();
    while (
      Date.now() < deadline &&
      !(activation.isActivated && activation.hasDatabase)
    ) {
      await page.waitForTimeout(1000);
      activation = await readActivation();
    }

    if (!(activation.isActivated && activation.hasDatabase)) {
      throw new Error(
        `notebook ${projectId} did not finish activating within 60s ` +
          `(exists=${activation.exists}, isActivated=${activation.isActivated}, ` +
          `hasDatabase=${activation.hasDatabase})`
      );
    }

    sessionLog(ctx.sessionId, 'notebook activated');
  });

  const notebookUrl = getNotebookUrl(env);
  await step(page, ctx, 'open-notebook', async () => {
    sessionLog(ctx.sessionId, `opening notebook at ${notebookUrl}`);
    // Don't wait for 'networkidle' here: once the notebook is activated, live
    // PouchDB<->CouchDB replication keeps connections open so the network never
    // goes idle and this would always time out. Readiness is asserted by the
    // later 'await-add-record-button' step instead.
    await page.goto(notebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    sessionLog(ctx.sessionId, `notebook opened - getting jwt token`);
  });

  // The JWT lives in the persisted redux auth slice (IndexedDB), not in
  // localStorage. Poll the persisted state for an active-user token.
  const jwtToken = await step(page, ctx, 'get-jwt-token', async () => {
    const deadline = Date.now() + 15000;
    let auth: PersistedAuthSummary | undefined;
    while (Date.now() < deadline) {
      auth = parsePersistedAuth((await readRawBrowserState(page)).persistAuthRaw);
      if (auth?.token) break;
      await page.waitForTimeout(1000);
    }

    if (!auth?.token) {
      await logBrowserState(page, ctx, 'get-jwt-token:no-token');
      sessionLog(
        ctx.sessionId,
        'no jwt token in persisted auth slice - app is not logged in'
      );
      return undefined;
    }

    sessionLog(
      ctx.sessionId,
      `jwt token retrieved (${auth.token.slice(0, 40)}…) for user ` +
        `${auth.activeUsername} on server ${auth.activeServerId}. ` +
        'Awaiting add record button'
    );
    return auth.token;
  });

  await step(page, ctx, 'await-add-record-button', async () => {
    await page.getByTestId('add-record-button').waitFor({timeout: 15000});
    sessionLog(ctx.sessionId, `add record button visible`);
  });

  return {jwtToken};
}
