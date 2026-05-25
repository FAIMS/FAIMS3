import type {Page} from 'playwright';
import {getNotebookUrl} from '../notebook-url.js';
import {sessionLog} from '../session-log.js';
import type {SessionContext} from '../types.js';

export interface OnboardingResult {
  jwtToken?: string;
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

  const start = Date.now();
  sessionLog(ctx.sessionId, `registering user at ${registerUrl.origin}`);
  await page.goto(registerUrl.toString(), {waitUntil: 'domcontentloaded'});

  const emailInput = page.locator('#EmailInput, input[name="email"]');
  if (await emailInput.count()) {
    await emailInput.fill(email);
    await page.locator('#NameInput, input[name="name"]').fill(`Load Test ${ctx.sessionId}`);
    await page.locator('#InputPassword, input[name="password"]').fill(password);
    await page.locator('#RepeatPassword, input[name="repeat"]').fill(password);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
  }

  await page.waitForURL(/auth-return|localhost:3000/, {timeout: 120000});
  sessionLog(ctx.sessionId, 'registration submitted, opening app');

  const loadMs = Date.now() - start;
  await page.evaluate(
    ({ms, pageName}) => {
      window.dispatchEvent(
        new CustomEvent('dass:page_load', {detail: {name: pageName, durationMs: ms}})
      );
    },
  {ms: loadMs, pageName: 'onboarding'}
  );

  await page.goto(env.DASS_APP_URL, {waitUntil: 'networkidle', timeout: 120000});

  const activateBtn = page.getByTestId('notebook-activate-button');
  if (await activateBtn.count()) {
    sessionLog(ctx.sessionId, 'activating notebook');
    await activateBtn.click();
    const confirmBtn = page.getByTestId('notebook-activate-confirm');
    if (await confirmBtn.count()) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(3000);
  }

  const notebookUrl = getNotebookUrl(env);
  sessionLog(ctx.sessionId, `opening notebook at ${notebookUrl}`);
  await page.goto(notebookUrl, {waitUntil: 'networkidle', timeout: 120000});
  await page.getByTestId('add-record-button').waitFor({timeout: 60000});

  const jwtToken =
    (await page.evaluate(() => localStorage.getItem('token'))) ?? undefined;

  return {jwtToken};
}
