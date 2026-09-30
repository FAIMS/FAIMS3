// SPDX-License-Identifier: Apache-2.0
import {Role} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../../../context/slices/projectSlice';

const harness = vi.hoisted(() => ({
  isOnline: true,
  username: 'ada',
  serverUrl: 'http://localhost:8080',
  resourceRoles: [] as {role: Role; resourceId: string}[],
  create: vi.fn(),
  revokeOwn: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../../../../utils/customHooks', () => ({
  useIsOnline: () => ({
    isOnline: harness.isOnline,
    checkIsOnline: () => harness.isOnline,
    fallback: null,
  }),
}));

vi.mock('../../../../context/store', () => ({
  useAppDispatch: () => harness.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        activeUser: {
          serverId: 'server-1',
          username: harness.username,
          token: 'token',
          parsedToken: {
            username: harness.username,
            server: harness.serverUrl,
            exp: 9_999_999_999,
            globalRoles: [],
            resourceRoles: harness.resourceRoles,
          },
        },
      },
      projects: {
        servers: {
          'server-1': {
            serverId: 'server-1',
            serverUrl: harness.serverUrl,
            serverTitle: 'Local',
          },
        },
      },
    }),
}));

vi.mock('../../../../utils/apiOperations/quickShare', () => ({
  createQuickShare: (...args: unknown[]) => harness.create(...args),
  revokeOwnQuickShares: (...args: unknown[]) => harness.revokeOwn(...args),
}));

vi.mock('@faims3/forms', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/forms')>();
  return {
    ...actual,
    PhotoLightbox: ({url, onClose}: {url: string; onClose: () => void}) => (
      <div role="dialog">
        <img src={url} alt="Full size preview" />
        <button type="button" onClick={onClose}>
          Close preview
        </button>
      </div>
    ),
  };
});

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (value: string) => `data:image/png;base64,${value}`),
  },
}));

import QRCode from 'qrcode';
import {HttpError} from '../../../../utils/apiOperations/client';
import NotebookQuickShare from './quickShare';

function conductorError(status: number, statusText: string, message: string) {
  return new HttpError(
    new Response(null, {status, statusText}),
    JSON.stringify({error: {message, status}})
  );
}

const project = {
  projectId: 'survey-1',
  serverId: 'server-1',
  isActivated: true,
  name: 'Creek survey',
} as Project;

function renderShare(next: Project = project) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <NotebookQuickShare project={next} />
    </ThemeProvider>
  );
}

function openShareDialog() {
  fireEvent.click(screen.getByTestId('app-quick-share-open'));
}

describe('NotebookQuickShare', () => {
  beforeEach(() => {
    harness.isOnline = true;
    harness.username = 'ada';
    harness.serverUrl = 'http://localhost:8080';
    harness.resourceRoles = [];
    harness.dispatch.mockReset();
    harness.revokeOwn.mockReset();
    vi.mocked(QRCode.toDataURL).mockClear();
    harness.revokeOwn.mockResolvedValue(undefined);
    harness.create.mockReset();
    harness.create.mockResolvedValue({
      _id: 'FAIMS-quicksharecode',
      _rev: '1-abc',
      name: 'Quick share',
      kind: 'quick-share',
      role: Role.PROJECT_GUEST,
      inviteType: 'RESOURCE_SPECIFIC',
      resourceType: 'PROJECT',
      resourceId: 'survey-1',
      createdBy: 'ada',
      createdAt: Date.now(),
      expiry: Date.now() + 60 * 60 * 1000,
      usesConsumed: 0,
      uses: [],
    });
  });

  it('hides the control when the user cannot create an invite', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_GUEST, resourceId: 'survey-1'},
    ];
    renderShare();
    expect(screen.queryByTestId('app-quick-share-open')).toBeNull();
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
  });

  it('hides the control until the survey is activated', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({...project, isActivated: false});
    expect(screen.queryByTestId('app-quick-share-open')).toBeNull();
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
  });

  it('hides the control when the survey disables quick share', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({...project, disableQuickShare: true});
    expect(screen.queryByTestId('app-quick-share-open')).toBeNull();
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
  });

  it('uses a heading, description, and primary button on the settings tab', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    render(
      <ThemeProvider theme={createTheme()}>
        <NotebookQuickShare project={project} layout="settings" />
      </ThemeProvider>
    );
    expect(screen.getByRole('heading', {name: 'Quick share'})).toBeTruthy();
    expect(
      screen.getByText(
        'Share this survey with another user by generating a temporary QR code.'
      )
    ).toBeTruthy();
    const open = screen.getByRole('button', {name: /^Share this /});
    expect(open).toBe(screen.getByTestId('app-quick-share-open'));
    expect(open.className).toMatch(/MuiButton-outlined/);
    expect(open.className).toMatch(/MuiButton-colorPrimary/);
    fireEvent.click(open);
    expect(screen.getByTestId('app-quick-share')).toBeTruthy();
  });

  it('offers only the invite levels a manager can create', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    openShareDialog();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', {name: /^Guest/})).toBeTruthy();
    expect(screen.getByRole('option', {name: /^Contributor/})).toBeTruthy();
    expect(screen.getByRole('option', {name: /^Manager/})).toBeTruthy();
    expect(screen.queryByRole('option', {name: /^Administrator/})).toBeNull();
    expect(screen.getByRole('option', {name: /^Guest/}).textContent).toMatch(
      /own/
    );
  });

  it('shows a short grant prompt only while generating a code', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
    openShareDialog();
    expect(screen.getByTestId('app-quick-share')).toBeTruthy();
    expect(
      screen.getByText('The user will be granted the role selected below.')
    ).toBeTruthy();
    expect(screen.queryByTestId('app-quick-share-revoke')).toBeNull();
  });

  it('disables generating a code while offline', () => {
    harness.isOnline = false;
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    openShareDialog();
    expect(screen.getByTestId('app-quick-share-offline')).toBeTruthy();
    expect(
      (screen.getByTestId('app-quick-share-generate') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('stores the new code on the project instead of leaving it only on screen', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    await vi.waitFor(() => expect(harness.dispatch).toHaveBeenCalled());
    const action = harness.dispatch.mock.calls[0][0];
    expect(action.payload.quickShare.inviteId).toBe('FAIMS-quicksharecode');
    expect(action.payload.quickShare.role).toBe(Role.PROJECT_GUEST);
    expect(action.payload.quickShare.createdBy).toBe('ada');
    expect(action.payload.quickShare.qrCode).toContain(
      'http://localhost:8080/register?inviteId=FAIMS-quicksharecode'
    );
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining(
        'http://localhost:8080/register?inviteId=FAIMS-quicksharecode'
      ),
      expect.objectContaining({width: 2048})
    );
    expect(harness.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'survey-1',
        username: 'ada',
        role: Role.PROJECT_GUEST,
      })
    );
  });

  it('encodes the stored conductor URL including a default HTTPS port', async () => {
    harness.serverUrl = 'https://conductor.bss.nbic.cloud:443';
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    await vi.waitFor(() => expect(harness.dispatch).toHaveBeenCalled());
    const encoded =
      'https://conductor.bss.nbic.cloud:443/register?inviteId=FAIMS-quicksharecode';
    const action = harness.dispatch.mock.calls[0][0];
    expect(action.payload.quickShare.qrCode).toContain(encoded);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      encoded,
      expect.objectContaining({width: 2048})
    );
    // InviteQRScanner rejects a URL() payload that dropped :443.
    expect(encoded.startsWith(harness.serverUrl)).toBe(true);
    expect(encoded.match(`${harness.serverUrl}/register.*`)).toBeTruthy();
  });

  it('shows the stored code, its role and expiry, and opens the lightbox', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    const expiry = Date.now() + 60 * 60 * 1000;
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_CONTRIBUTOR,
        expiry,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    expect(screen.queryByTestId('app-quick-share-generate')).toBeNull();
    expect(
      screen.queryByText('The user will be granted the role selected below.')
    ).toBeNull();
    expect(screen.queryByText(/Show this code/)).toBeNull();
    expect(screen.queryByTestId('app-quick-share-show-code')).toBeNull();
    expect(screen.queryByTestId('app-quick-share-code')).toBeNull();
    expect(screen.getByRole('heading', {name: /^Share this /})).toBeTruthy();
    const newCode = screen.getByTestId('app-quick-share-revoke');
    expect(newCode.textContent).toBe('Start again');
    expect(newCode.className).toMatch(/MuiButton-outlined/);
    expect(screen.getByTestId('app-quick-share-role-label').textContent).toBe(
      'Contributor'
    );
    expect(screen.getByText('Expires')).toBeTruthy();
    expect(
      screen.getByTestId('app-quick-share-expiry').textContent?.length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('app-quick-share-qr'));
    expect(screen.getByAltText('Full size preview').getAttribute('src')).toBe(
      'data:image/png;base64,qr'
    );
  });

  it('returns to generating a code when the stored one has expired', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_GUEST,
        expiry: Date.now() - 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    expect(screen.getByTestId('app-quick-share-generate')).toBeTruthy();
    expect(screen.queryByText('Expired')).toBeNull();
    expect(screen.queryByTestId('app-quick-share-qr')).toBeNull();
    expect(harness.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {projectId: 'survey-1', serverId: 'server-1'},
      })
    );
  });

  it('fits the new-code confirmation on a narrow phone', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_GUEST,
        expiry: Date.now() + 60 * 60 * 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-revoke'));

    const cancel = screen.getByTestId('app-quick-share-revoke-cancel');
    const confirm = screen.getByTestId('app-quick-share-revoke-confirm');
    const actions = cancel.parentElement;
    expect(actions).toBeTruthy();
    expect(actions?.className).toMatch(/MuiDialogActions-root/);
    expect(getComputedStyle(cancel).textTransform).toBe('none');
    expect(getComputedStyle(confirm).textTransform).toBe('none');
    expect(getComputedStyle(actions!).flexWrap).toBe('wrap');

    const stacked = Array.from(document.querySelectorAll('style'))
      .map(style => style.textContent ?? '')
      .join('\n');
    expect(stacked).toMatch(/flex-direction:\s*column-reverse/);
    expect(stacked).toMatch(/max-width:\s*599\.95px/);
  });

  it('revokes the stored code before another one can be generated', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    const {rerender} = renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_GUEST,
        expiry: Date.now() + 60 * 60 * 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-revoke'));
    fireEvent.click(screen.getByTestId('app-quick-share-revoke-confirm'));
    await vi.waitFor(() => expect(harness.revokeOwn).toHaveBeenCalled());
    expect(harness.revokeOwn).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'survey-1',
        username: 'ada',
      })
    );
    expect(harness.revokeOwn.mock.calls[0]?.[0]).not.toHaveProperty('inviteId');
    expect(harness.dispatch).toHaveBeenCalled();
    rerender(
      <ThemeProvider theme={createTheme()}>
        <NotebookQuickShare project={project} />
      </ThemeProvider>
    );
    expect(screen.getByTestId('app-quick-share-generate')).toBeTruthy();
  });

  it('tells the user when the survey is gone instead of failing silently', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.create.mockRejectedValue(
      new HttpError(new Response(null, {status: 404, statusText: 'Not Found'}))
    );
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    expect(
      await screen.findByText('This survey is no longer on the server.')
    ).toBeTruthy();
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('app-quick-share-result')).toBeNull();
  });

  it('drops the stored code when the invite is already gone', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.revokeOwn.mockRejectedValue(
      new HttpError(new Response(null, {status: 404, statusText: 'Not Found'}))
    );
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_GUEST,
        expiry: Date.now() + 60 * 60 * 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-revoke'));
    fireEvent.click(screen.getByTestId('app-quick-share-revoke-confirm'));
    await vi.waitFor(() => expect(harness.dispatch).toHaveBeenCalled());
    expect(harness.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {projectId: 'survey-1', serverId: 'server-1'},
      })
    );
    expect(
      screen.queryByText('This survey is no longer on the server.')
    ).toBeNull();
    expect(
      screen.queryByText(
        'Could not update the quick share code. Check your connection and try again.'
      )
    ).toBeNull();
    await vi.waitFor(() => {
      expect(screen.queryByRole('heading', {name: 'Start again?'})).toBeNull();
    });
  });

  it('shows the role denial only when the server says the level is not allowed', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.create.mockRejectedValue(
      conductorError(
        401,
        'Unauthorized',
        'You are not authorized to share this survey at that level'
      )
    );
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    expect(
      await screen.findByText(
        'You are not allowed to share this survey at that level.'
      )
    ).toBeTruthy();
    expect(screen.queryByTestId('app-quick-share-revoke-own')).toBeNull();
  });

  it('says when quick share is disabled instead of blaming the access level', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.create.mockRejectedValue(
      conductorError(
        403,
        'Forbidden',
        'Quick share is disabled for this survey'
      )
    );
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    expect(
      await screen.findByText('Quick share is disabled for this survey.')
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'You are not allowed to share this survey at that level.'
      )
    ).toBeNull();
    expect(screen.queryByTestId('app-quick-share-revoke-own')).toBeNull();
  });

  it('offers to revoke the caller’s own code when a higher-role code is still active', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.create.mockRejectedValue(
      conductorError(
        403,
        'Forbidden',
        'A quick share above your current access is still active. It must be revoked before a new code can be issued.'
      )
    );
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    expect(
      await screen.findByText(
        'A code above your current access is still active. Revoke it before generating a new one.'
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('app-quick-share-revoke-own'));
    await vi.waitFor(() => expect(harness.revokeOwn).toHaveBeenCalled());
    expect(harness.revokeOwn).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'survey-1',
        username: 'ada',
      })
    );
    await vi.waitFor(() =>
      expect(screen.queryByTestId('app-quick-share-revoke-own')).toBeNull()
    );
  });

  it('does not treat a status-only 403 as a level denial', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.create.mockRejectedValue(
      new HttpError(new Response(null, {status: 403, statusText: 'Forbidden'}))
    );
    renderShare();
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    expect(
      await screen.findByText(
        'Could not update the quick share code. Check your connection and try again.'
      )
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'You are not allowed to share this survey at that level.'
      )
    ).toBeNull();
  });

  it('keeps the stored code when revoke is refused and explains why', async () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    harness.revokeOwn.mockRejectedValue(
      conductorError(
        401,
        'Unauthorized',
        'You are not authorized to delete this invite'
      )
    );
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_GUEST,
        expiry: Date.now() + 60 * 60 * 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    fireEvent.click(screen.getByTestId('app-quick-share-revoke'));
    fireEvent.click(screen.getByTestId('app-quick-share-revoke-confirm'));
    expect(
      await screen.findAllByText('You are not allowed to revoke this code.')
    ).toHaveLength(2);
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('app-quick-share-qr')).toBeTruthy();
  });

  it('tells the user a stored code is above their current access', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({
      ...project,
      quickShare: {
        inviteId: 'FAIMS-quicksharecode',
        role: Role.PROJECT_ADMIN,
        expiry: Date.now() + 60 * 60 * 1000,
        qrCode: 'data:image/png;base64,qr',
        createdBy: 'ada',
      },
    });
    openShareDialog();
    expect(
      screen.getByTestId('app-quick-share-above-access').textContent
    ).toMatch(/above your current access/);
    const revoke = screen.getByTestId(
      'app-quick-share-revoke'
    ) as HTMLButtonElement;
    expect(revoke.disabled).toBe(false);
    expect(screen.getByTestId('app-quick-share-qr')).toBeTruthy();
  });

  it("hides another user's redemption code after a user switch, including an admin code", () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    const quickShare = {
      inviteId: 'FAIMS-quicksharecode',
      role: Role.PROJECT_ADMIN,
      expiry: Date.now() + 60 * 60 * 1000,
      qrCode: 'data:image/png;base64,admin-secret',
      createdBy: 'ada',
    };
    const {rerender} = renderShare({...project, quickShare});
    openShareDialog();
    expect(screen.getByTestId('app-quick-share-qr')).toBeTruthy();
    expect(
      (screen.getByTestId('app-quick-share-revoke') as HTMLButtonElement)
        .disabled
    ).toBe(false);

    harness.username = 'bea';
    rerender(
      <ThemeProvider theme={createTheme()}>
        <NotebookQuickShare project={{...project, quickShare}} />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('app-quick-share-qr')).toBeNull();
    expect(
      document.querySelector('img[src="data:image/png;base64,admin-secret"]')
    ).toBeNull();
    expect(screen.queryByTestId('app-quick-share-revoke')).toBeNull();
    expect(screen.queryByTestId('app-quick-share-above-access')).toBeNull();
    expect(screen.getByTestId('app-quick-share-generate')).toBeTruthy();
    expect(harness.dispatch).not.toHaveBeenCalled();

    harness.username = 'ada';
    rerender(
      <ThemeProvider theme={createTheme()}>
        <NotebookQuickShare project={{...project, quickShare}} />
      </ThemeProvider>
    );
    expect(screen.getByTestId('app-quick-share-qr')).toBeTruthy();
    expect(
      (screen.getByTestId('app-quick-share-revoke') as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});
