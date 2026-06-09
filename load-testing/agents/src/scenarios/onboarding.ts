import {mkdir} from 'fs/promises';
import path from 'path';
import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {
  addRecordButton,
  notebookActivateButton,
  notebookActivateConfirm,
} from '../selectors.js';
import {sessionLog} from '../session-log.js';
import {CoordinatorClient} from '@faims3/load-testing-shared';
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

/** Return captured console/page-error buffers for a page (may be empty). */
function getDebugBuffers(page: Page): PageDebugBuffers {
  return pageDebugBuffers.get(page) ?? {consoleMessages: [], pageErrors: []};
}

/** Sanitise a string for safe use in screenshot filenames. */
function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/** Save a full-page PNG when an onboarding step fails. */
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

/** Switch to the not-active notebook list (tabs or headings layout). */
async function focusNotActiveNotebooks(page: Page, sessionId: string): Promise<void> {
  const notActiveTab = page.getByRole('tab', {name: /not active/i});
  if ((await notActiveTab.count()) > 0) {
    sessionLog(sessionId, 'notebook list layout: tabs');
    await notActiveTab.first().waitFor({state: 'visible', timeout: 30000});
    await notActiveTab.first().click();
    return;
  }

  sessionLog(sessionId, 'notebook list layout: headings');
  // Headings layout renders both grids; wait for the not-active section label.
  await page
    .getByText('Not Active', {exact: true})
    .first()
    .waitFor({state: 'visible', timeout: 30000});
}

/** Run an onboarding sub-step with screenshot + debug dump on failure. */
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

/** Login, activate notebook, open record list; returns JWT for export phase. */
export async function runOnboarding(
  page: Page,
  ctx: SessionContext,
  coordinator: CoordinatorClient
): Promise<OnboardingResult> {
  const {env} = ctx;
  const {username: email, password} = await coordinator.getCredentials(
    ctx.agentId
  );
  sessionLog(ctx.sessionId, `using pre-seeded account ${email}`);
  const loginUrl = new URL('/login', env.FAIMS_API_URL);
  loginUrl.searchParams.set('redirect', `${env.FAIMS_APP_URL}/auth-return`);

  // Capture browser console + page errors so we can see what the app logs while
  // it attempts to exchange the token and log in. Registered against the page
  // so every step's failure handler can dump them too.
  attachConsoleCapture(page);

  const start = Date.now();

  await step(page, ctx, 'login', async () => {
    sessionLog(ctx.sessionId, `logging in at ${loginUrl.origin}`);
    await page.goto(loginUrl.toString(), {waitUntil: 'domcontentloaded'});

    const emailInput = page.locator(
      '#EmailInput, [data-testid="email-input"], input[name="email"]'
    );
    const passwordInput = page.locator(
      '#InputPassword, [data-testid="password-input"], input[name="password"]'
    );
    await emailInput.waitFor({state: 'visible', timeout: 30000});
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page
      .locator(
        '[data-testid="login-submit-button"], button[type="submit"], input[type="submit"]'
      )
      .first()
      .click();
  });

  await step(page, ctx, 'await-auth-return', async () => {
    await page.waitForURL(/auth-return|localhost:3000/, {timeout: 120000});
    sessionLog(ctx.sessionId, `login submitted, landed on ${page.url()}`);

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
          new CustomEvent('faims:page_load', {
            detail: {name: pageName, durationMs: ms},
          })
        );
      },
      {ms: loadMs, pageName: 'onboarding'}
    );
  });

  await step(page, ctx, 'open-app', async () => {
    // Avoid 'networkidle' - live sync can keep the network busy indefinitely.
    await page.goto(env.FAIMS_APP_URL, {
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
    // readiness is asserted by waiting for the not-active list below.
    await page.goto(env.FAIMS_APP_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Tabs: click "Not Active". Headings: both sections are already visible.
    await focusNotActiveNotebooks(page, ctx.sessionId);

    const refreshBtn = page.getByRole('button', {name: /^REFRESH$/i});
    if (await refreshBtn.count()) {
      sessionLog(ctx.sessionId, 'refreshing notebook list from API');
      await refreshBtn.first().click();
      await page.waitForTimeout(5000);
    }

    const emptyNotActive = page.getByText(
      "You don't have any unactivated surveys.",
      {exact: true}
    );
    const targetRow = page.locator(`[role="row"][data-id="${projectId}"]`);
    const listDeadline = Date.now() + 20000;
    while (Date.now() < listDeadline && !(await targetRow.count())) {
      if (await emptyNotActive.isVisible()) {
        const auth = await logBrowserState(page, ctx, 'activate-notebook:empty-list');
        throw new Error(
          `notebook ${projectId} is not listed for ${auth?.activeUsername ?? 'this user'} — ` +
            `the app could not load GET /api/notebooks/${projectId} (see console 404/metadata errors). ` +
            `Confirm NOTEBOOK_PROJECT_ID matches a survey on ${env.FAIMS_API_URL} and re-run ` +
            `seed-load-test-accounts.sh against that environment's CouchDB.`
        );
      }
      await page.waitForTimeout(1000);
    }

    // The notebook list is a MUI DataGrid; each row's data-id is its projectId.
    // Target our notebook's row specifically, falling back to the first row if
    // we can't match it (e.g. only one notebook is present).
    const row = page.locator(`[role="row"][data-id="${projectId}"]`);
    const activateButton = (await row.count())
      ? notebookActivateButton(page, row)
      : notebookActivateButton(page);

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
    const confirmBtn = notebookActivateConfirm(page);
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
    await addRecordButton(page).waitFor({timeout: 15000});
    sessionLog(ctx.sessionId, `add record button visible`);
  });

  return {jwtToken};
}
