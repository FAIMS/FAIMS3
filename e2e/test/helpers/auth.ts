/**
 * Shared login/logout helpers for app, web (Control Centre), and Conductor.
 */
import {browser, $} from '@wdio/globals';
import API_Login from '../pageobjects/api-login.ts';
import LoginPage from '../pageobjects/app-signin.ts';
import {
  getAppUrl,
  getPersona,
  getWebUrl,
  type Credentials,
  type PersonaKey,
} from './env.ts';
import {byTestId} from './selectors.ts';
import {waitForTestId, waitForUrl} from './wait.ts';

export function persona(key: PersonaKey): Credentials {
  return getPersona(key);
}

/**
 * Log in via Conductor local auth form (must already be on /login with redirect).
 *
 * Do NOT call API_Login.open() before this — that would navigate away from the
 * current URL (which already contains the correct ?redirect= parameter set by
 * the server / caller).
 */
export async function submitConductorLogin(user: Credentials): Promise<void> {
  await API_Login.waitForPageLoad();
  if (!(await API_Login.isLocalAuthAvailable())) {
    throw new Error('Local auth form not available on Conductor login page');
  }
  await API_Login.enterEmail(user.email);
  await API_Login.enterPassword(user.password);
  await API_Login.clickLogin();
}

/**
 * Open Conductor login (optionally with redirect) and authenticate.
 */
export async function loginConductor(
  user: Credentials,
  options: {redirect?: string} = {}
): Promise<void> {
  const redirect = options.redirect;
  const path = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : '/login';
  // Conductor is on :8080 — navigate absolutely
  const conductorBase = process.env.CONDUCTOR_URL || 'http://localhost:8080';
  await browser.url(`${conductorBase.replace(/\/$/, '')}${path}`);
  await submitConductorLogin(user);
}

/**
 * Control Centre login: dashboard → Conductor redirect → exchangeToken → main.
 *
 * Flow:
 *  1. Navigate to the dashboard root → triggers redirect to API login.
 *  2. Fill credentials on the Conductor form (preserving ?redirect=).
 *  3. Wait for redirect back with ?exchangeToken=...&serverId=...
 *  4. Wait for TanStack Router beforeLoad (token exchange) and React render.
 *
 * Mobile viewports use an off-canvas Sheet for the sidebar; data-sidebar="sidebar"
 * is only in the DOM when that sheet is open. The protected layout <main> is
 * always rendered once auth + token exchange complete — wait on that.
 */
export async function loginWeb(user: Credentials): Promise<void> {
  const webUrl = getWebUrl();
  // Navigate to dashboard root (absolute URL — baseUrl may be app or web).
  await browser.url(webUrl);

  // The protected route redirects unauthenticated users to the API login page.
  await waitForUrl('/login', {
    timeout: 15000,
    timeoutMsg:
      'Expected redirect to API login page after navigating to the dashboard',
  });

  await submitConductorLogin(user);

  // After a successful login the API redirects back with ?exchangeToken=...
  await browser.waitUntil(
    async () => (await browser.getUrl()).startsWith(webUrl),
    {
      timeout: 15000,
      timeoutMsg: 'Expected redirect back to the web dashboard after login',
    }
  );

  // Wait for the TanStack Router beforeLoad (token exchange) and React render.
  await browser.waitUntil(
    () => browser.execute(() => document.readyState === 'complete'),
    {timeout: 10000}
  );

  await browser.waitUntil(
    async () => {
      const url = await browser.getUrl();
      return (
        url.startsWith(webUrl) &&
        !url.includes('exchangeToken') &&
        (await $('main').isExisting())
      );
    },
    {
      timeout: 15000,
      timeoutMsg: 'Expected authenticated dashboard (main content) after login',
    }
  );
}

export async function loginWebPersona(key: PersonaKey): Promise<void> {
  await loginWeb(getPersona(key));
}

/**
 * Fieldmark app login: /signin → Sign in → Conductor → auth-return → workspace.
 *
 * Conductor redirects to `/auth-return/?exchangeToken=...&serverId=...`. Do not
 * treat that as "logged in": a later full navigation (e.g. AppNotebooksPage.open)
 * aborts the in-flight exchange and leaves the session on /signin/. Mirror
 * loginWeb — wait until exchangeToken is gone and the authenticated shell is up.
 */
export async function loginApp(user: Credentials): Promise<void> {
  const appUrl = getAppUrl();
  await LoginPage.open();
  await LoginPage.clickSignIn();
  await API_Login.waitForPageLoad();
  await submitConductorLogin(user);

  await browser.waitUntil(
    async () => (await browser.getUrl()).startsWith(appUrl),
    {
      timeout: 20000,
      timeoutMsg: 'Expected redirect back to the app after Conductor login',
    }
  );

  await browser.waitUntil(
    () => browser.execute(() => document.readyState === 'complete'),
    {timeout: 10000}
  );

  await browser.waitUntil(
    async () => {
      const url = await browser.getUrl();
      return (
        url.startsWith(appUrl) &&
        !url.includes('exchangeToken') &&
        !url.includes('/auth-return') &&
        !url.includes('/signin') &&
        ((await byTestId('app-notebooks-heading').isExisting()) ||
          (await byTestId('app-nav-user-menu').isExisting()))
      );
    },
    {
      timeout: 20000,
      timeoutMsg:
        'Expected authenticated app workspace after exchangeToken handling',
    }
  );
}

export async function loginAppPersona(key: PersonaKey): Promise<void> {
  await loginApp(getPersona(key));
}

/**
 * Best-effort logout for Control Centre (user menu).
 * Opens the user dropdown first — `web-nav-logout` is a Radix DropdownMenuItem
 * and is only mounted while the menu is open. Falls back to clearing
 * cookies/storage + navigating away (web origin only; Conductor session on
 * :8080 may survive — prefer the UI path).
 */
export async function logoutWeb(): Promise<void> {
  const webUrl = getWebUrl();
  try {
    const menu = byTestId('web-nav-user-menu');
    await menu.waitForClickable({timeout: 5000});
    await menu.click();
    const logout = await waitForTestId('web-nav-logout', {timeout: 5000});
    await logout.waitForClickable({timeout: 5000});
    await logout.click();
    return;
  } catch {
    // fall through
  }
  await browser.deleteCookies();
  await browser.execute(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await browser.url(webUrl);
}

/**
 * Best-effort app logout / session clear.
 */
export async function logoutApp(): Promise<void> {
  await browser.deleteCookies();
  try {
    await browser.execute(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
    // ignore
  }
  await browser.url(`${getAppUrl()}/signin`);
}
