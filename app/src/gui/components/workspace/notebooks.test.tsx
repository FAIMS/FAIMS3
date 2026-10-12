// SPDX-License-Identifier: Apache-2.0
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {config} from '../../../buildconfig';

const harness = vi.hoisted(() => ({
  isOnline: true,
}));

vi.mock('../../../utils/customHooks', () => ({
  useIsOnline: () => ({
    isOnline: harness.isOnline,
    checkIsOnline: () => harness.isOnline,
    fallback: null,
  }),
}));

vi.mock('../../../context/store', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        activeUser: {
          serverId: 'server-1',
          username: 'ada',
          token: 'token',
        },
      },
      projects: {
        servers: {
          'server-1': {
            serverId: 'server-1',
            serverUrl: 'http://localhost:8080',
            serverTitle: 'Local',
            listed: {
              'survey-1': {
                projectId: 'survey-1',
                serverId: 'server-1',
                isActivated: false,
                name: 'Creek survey',
              },
            },
            activated: {},
          },
        },
      },
    }),
}));

vi.mock('../../../context/popup', () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('../ui/heading-grid', () => ({default: () => null}));
vi.mock('../ui/tab-grid', () => ({default: () => null}));
vi.mock('../authentication/inviteCodeEntry', () => ({
  InviteCodeEntry: () => null,
  InviteQRScanner: () => null,
}));
vi.mock('../notebook/settings/sync_switch', () => ({default: () => null}));

import NoteBooks from './notebooks';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderNotebooks() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={createTheme()}>
        <NoteBooks />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('NoteBooks add survey button', () => {
  beforeEach(() => {
    harness.isOnline = true;
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  it('lets the user add a survey while online', () => {
    renderNotebooks();
    const add = screen.getByTestId(
      'app-notebooks-add-button'
    ) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    expect(screen.queryByTestId('app-notebooks-add-offline-icon')).toBeNull();
    fireEvent.click(add);
    expect(
      screen.getByTestId('app-notebooks-add-dialog').getAttribute('aria-hidden')
    ).toBe('false');
  });

  it('disables adding a survey while offline and shows a missing wifi icon', () => {
    harness.isOnline = false;
    renderNotebooks();
    const add = screen.getByTestId(
      'app-notebooks-add-button'
    ) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByTestId('app-notebooks-add-offline-icon')).toBeTruthy();
    fireEvent.mouseOver(add);
    expect(
      screen.getByLabelText(
        `You must be online to accept a ${config.notebookName} invitation.`
      )
    ).toBeTruthy();
    fireEvent.click(add);
    expect(
      screen.getByTestId('app-notebooks-add-dialog').getAttribute('aria-hidden')
    ).toBe('true');
    expect(
      screen.getByTestId('app-notebooks-offline-activate-warning').textContent
    ).toBe(
      `Connect to the internet to activate this ${config.notebookName}. Activation prepares the ${config.notebookName} for offline use.`
    );
  });
});
