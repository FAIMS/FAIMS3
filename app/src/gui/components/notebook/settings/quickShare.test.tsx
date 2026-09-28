import {Role} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../../../context/slices/projectSlice';

const harness = vi.hoisted(() => ({
  isOnline: true,
  resourceRoles: [] as {role: Role; resourceId: string}[],
  create: vi.fn(),
  revoke: vi.fn(),
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
          username: 'ada',
          token: 'token',
          parsedToken: {
            username: 'ada',
            server: 'http://localhost:8080',
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
            serverUrl: 'http://localhost:8080',
            serverTitle: 'Local',
          },
        },
      },
    }),
}));

vi.mock('../../../../utils/apiOperations/quickShare', () => ({
  createQuickShare: (...args: unknown[]) => harness.create(...args),
  revokeQuickShare: (...args: unknown[]) => harness.revoke(...args),
}));

vi.mock('@faims3/forms', () => ({
  PhotoLightbox: ({url, onClose}: {url: string; onClose: () => void}) => (
    <div role="dialog">
      <img src={url} alt="Full size preview" />
      <button type="button" onClick={onClose}>
        Close preview
      </button>
    </div>
  ),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (value: string) => `data:image/png;base64,${value}`),
  },
}));

import NotebookQuickShare from './quickShare';

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

describe('NotebookQuickShare', () => {
  beforeEach(() => {
    harness.isOnline = true;
    harness.resourceRoles = [];
    harness.dispatch.mockReset();
    harness.revoke.mockReset();
    harness.revoke.mockResolvedValue(undefined);
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
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
  });

  it('hides the control until the survey is activated', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare({...project, isActivated: false});
    expect(screen.queryByTestId('app-quick-share')).toBeNull();
  });

  it('offers only the invite levels a manager can create', () => {
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', {name: 'Guest'})).toBeTruthy();
    expect(screen.getByRole('option', {name: 'Contributor'})).toBeTruthy();
    expect(screen.getByRole('option', {name: 'Manager'})).toBeTruthy();
    expect(screen.queryByRole('option', {name: 'Administrator'})).toBeNull();
  });

  it('disables generating a code while offline', () => {
    harness.isOnline = false;
    harness.resourceRoles = [
      {role: Role.PROJECT_MANAGER, resourceId: 'survey-1'},
    ];
    renderShare();
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
    fireEvent.click(screen.getByTestId('app-quick-share-generate'));
    await vi.waitFor(() => expect(harness.dispatch).toHaveBeenCalled());
    const action = harness.dispatch.mock.calls[0][0];
    expect(action.payload.quickShare.inviteId).toBe('FAIMS-quicksharecode');
    expect(action.payload.quickShare.role).toBe(Role.PROJECT_GUEST);
    expect(action.payload.quickShare.qrCode).toContain(
      'http://localhost:8080/register?inviteId=FAIMS-quicksharecode'
    );
    expect(harness.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'survey-1',
        username: 'ada',
        role: Role.PROJECT_GUEST,
        lifetimeMs: 60 * 60 * 1000,
      })
    );
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
      },
    });
    expect(screen.queryByTestId('app-quick-share-generate')).toBeNull();
    expect(screen.getByTestId('app-quick-share-role-label').textContent).toBe(
      'Contributor'
    );
    expect(screen.getByText('Expires')).toBeTruthy();
    expect(
      screen.getByTestId('app-quick-share-expiry').textContent?.length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('app-quick-share-qr'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByAltText('Full size preview').getAttribute('src')).toBe(
      'data:image/png;base64,qr'
    );
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
      },
    });
    fireEvent.click(screen.getByTestId('app-quick-share-revoke'));
    fireEvent.click(screen.getByTestId('app-quick-share-revoke-confirm'));
    await vi.waitFor(() => expect(harness.revoke).toHaveBeenCalled());
    expect(harness.revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'survey-1',
        inviteId: 'FAIMS-quicksharecode',
      })
    );
    expect(harness.dispatch).toHaveBeenCalled();
    rerender(
      <ThemeProvider theme={createTheme()}>
        <NotebookQuickShare project={project} />
      </ThemeProvider>
    );
    expect(screen.getByTestId('app-quick-share-generate')).toBeTruthy();
  });
});
