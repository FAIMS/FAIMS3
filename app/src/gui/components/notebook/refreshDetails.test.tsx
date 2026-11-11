// SPDX-License-Identifier: Apache-2.0
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../../context/slices/projectSlice';
import {config} from '../../../buildconfig';

const harness = vi.hoisted(() => ({
  isOnline: true,
  refreshPayloads: [] as unknown[],
  fetch: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../../../utils/customHooks', () => ({
  useIsOnline: () => ({
    isOnline: harness.isOnline,
    checkIsOnline: () => harness.isOnline,
    fallback: null,
  }),
}));

vi.mock('../../../context/store', () => ({
  useAppDispatch: () => harness.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock('../../../context/popup', () => ({
  useNotification: () => ({
    showSuccess: harness.showSuccess,
    showError: harness.showError,
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('../../../context/slices/projectSlice', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../../context/slices/projectSlice')
    >();
  return {
    ...actual,
    refreshProjectDetails: (payload: unknown) => {
      harness.refreshPayloads.push(payload);
      return {type: 'projects/refreshProjectDetails', payload};
    },
  };
});

import NotebookDetailsRefresh from './refreshDetails';

const project = {
  projectId: 'survey-1',
  serverId: 'server-1',
  isActivated: true,
  name: 'Creek survey',
} as Project;

function renderRefresh(next: Project = project) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <NotebookDetailsRefresh project={next} />
    </ThemeProvider>
  );
}

describe('NotebookDetailsRefresh', () => {
  beforeEach(() => {
    if (!window.matchMedia) {
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList;
    }
    harness.isOnline = true;
    harness.refreshPayloads = [];
    harness.showSuccess.mockReset();
    harness.showError.mockReset();
    harness.fetch.mockReset();
    harness.dispatch.mockReset();
    harness.dispatch.mockImplementation((action: unknown) => {
      return {
        unwrap: () => Promise.resolve(action),
      };
    });
    vi.stubGlobal('fetch', harness.fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows an enabled Refresh control while online and dispatches the refresh path', async () => {
    renderRefresh();
    const refresh = screen.getByTestId(
      'app-notebook-refresh-button'
    ) as HTMLButtonElement;
    expect(refresh.disabled).toBe(false);
    expect(
      screen.queryByTestId('app-notebook-refresh-offline-icon')
    ).toBeNull();
    fireEvent.click(refresh);
    await waitFor(() => {
      expect(harness.dispatch).toHaveBeenCalled();
    });
    expect(harness.refreshPayloads).toEqual([
      {projectId: 'survey-1', serverId: 'server-1'},
    ]);
  });

  it('shows a disabled wifi-off control while offline and does not fetch', () => {
    harness.isOnline = false;
    renderRefresh();
    const refresh = screen.getByTestId(
      'app-notebook-refresh-button'
    ) as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    expect(
      screen.getByTestId('app-notebook-refresh-offline-icon')
    ).toBeTruthy();
    fireEvent.mouseOver(refresh);
    expect(
      screen.getByLabelText(
        `You must be online to refresh this ${config.notebookName}.`
      )
    ).toBeTruthy();
    fireEvent.click(refresh);
    expect(harness.refreshPayloads).toEqual([]);
    expect(harness.fetch).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
  });
});
