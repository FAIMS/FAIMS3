/**
 * Conductor registration via team invite (API-created code; no email).
 * Covers brand-new account registration and existing seed-user accept.
 */
import {loginWebPersona, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {getConductorUrl, getWebUrl} from '../../helpers/env.ts';
import {createTeamInvite, findTeamIdByName} from '../../helpers/seed.ts';
import API_Register from '../../pageobjects/api-register.ts';

describe('Conductor — Register via invite', () => {
  const password = `E2eInvitePass${Date.now()}!`;
  let registerUrl = '';
  let inviteId = '';

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    const teamId = await findTeamIdByName('Blue');
    const invite = await createTeamInvite({
      teamId,
      name: `E2E Register Invite ${Date.now()}`,
      role: 'TEAM_MEMBER',
      uses: 2,
    });
    inviteId = invite.inviteId;
    registerUrl = invite.registerUrl;
  });

  it('should register a new user with a team invite', async () => {
    expect(inviteId.length).toBeGreaterThan(0);
    await browser.reloadSession();
    await browser.url(registerUrl);

    await API_Register.waitForPageLoad();
    await expect(API_Register.registerForm).toBeDisplayed();
    const hiddenInvite = await API_Register.getInviteIdValue();
    expect(hiddenInvite).toBe(inviteId);

    const email = `e2e-invite-${Date.now()}@faims.test`;
    await API_Register.register(email, 'E2E Invitee', password, password);

    const webOrigin = getWebUrl();
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return url.startsWith(webOrigin) && url.includes('exchangeToken');
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected redirect to ${webOrigin} with exchangeToken after register`,
      }
    );
    await captureStep({
      surface: 'conductor',
      label: 'register-new-user',
    });
  });

  it('existing seed-user should accept a team invite', async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    const teamId = await findTeamIdByName('Blue');
    const invite = await createTeamInvite({
      teamId,
      name: `E2E Existing Invite ${Date.now()}`,
      role: 'TEAM_MEMBER',
      uses: 1,
    });

    const existing = persona('user');
    await browser.reloadSession();
    await browser.url(invite.registerUrl);
    await API_Register.waitForPageLoad();

    // Same email/password as seed-user → login + apply invite path.
    await API_Register.register(
      existing.email,
      'General User',
      existing.password,
      existing.password
    );

    const webOrigin = getWebUrl();
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return (
          (url.startsWith(webOrigin) && url.includes('exchangeToken')) ||
          url.includes('/teams/') ||
          (url.startsWith(webOrigin) &&
            !url.includes('/login') &&
            !url.includes('/register'))
        );
      },
      {
        timeout: 25000,
        timeoutMsg: 'Expected redirect after existing-user invite registration',
      }
    );

    // Confirm invite consumed (public metadata).
    const meta = await browser.execute(
      async (apiBase: string, id: string) => {
        const res = await fetch(`${apiBase}/api/invites/${id}`);
        return {ok: res.ok, status: res.status, body: await res.json()};
      },
      getConductorUrl().replace(/\/$/, ''),
      invite.inviteId
    );
    expect(meta.ok).toBe(true);
    const body = meta.body as {
      isValid?: boolean;
      usesRemaining?: number;
    };
    // Single-use invite should be exhausted or invalid after consume.
    const exhausted =
      body.isValid === false ||
      (typeof body.usesRemaining === 'number' && body.usesRemaining < 1);
    expect(exhausted).toBe(true);

    await captureStep({
      surface: 'conductor',
      label: 'existing-user-invite',
    });
  });
});
