// SPDX-License-Identifier: Apache-2.0
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {fireEvent, render, screen} from '@testing-library/react';
import {GridColDef} from '@mui/x-data-grid';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import type {Project} from '../../../context/slices/projectSlice';
import {isProjectActivating} from '../../../lib/notebookListDisplay';
import HeadingProjectGrid from './heading-grid';

const navigate = vi.fn();

vi.mock('../../../context/store', () => ({
  store: {
    getState: vi.fn(),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('../workspace/notebooks', () => ({
  ACTIVATED_LABEL: 'Active',
  NOT_ACTIVATED_LABEL: 'Not Active',
  notebookListDataGridSx: {},
}));

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const listed = {
  projectId: 'survey-1',
  serverId: 'server-1',
  isActivated: false,
  name: 'Creek survey',
} as Project;

const ready = {
  projectId: 'survey-2',
  serverId: 'server-1',
  isActivated: true,
  name: 'Ready survey',
} as Project;

function columns(
  activatingProjectKeys: readonly string[]
): GridColDef<Project>[] {
  return [
    {field: 'name', headerName: 'Name', flex: 1},
    {
      field: 'actions',
      type: 'actions',
      width: 140,
      renderCell: ({row}) =>
        isProjectActivating(row, activatingProjectKeys) ? (
          <span data-testid="app-notebook-activating-indicator">
            Activating
          </span>
        ) : null,
    },
  ];
}

function renderGrid({
  projects,
  activatingProjectKeys = [],
}: {
  projects: Project[];
  activatingProjectKeys?: readonly string[];
}) {
  const cols = columns(activatingProjectKeys);
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <HeadingProjectGrid
          projects={projects}
          serverId="server-1"
          activatedColumns={cols}
          notActivatedColumns={cols}
          activatingProjectKeys={activatingProjectKeys}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('HeadingProjectGrid activating rows', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  it('shows an activating listed notebook in the Active section with a loading indicator', () => {
    const keys = [`${listed.serverId}:${listed.projectId}`];
    renderGrid({
      projects: [listed],
      activatingProjectKeys: keys,
    });

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Creek survey')).toBeTruthy();
    expect(
      screen.getByTestId('app-notebook-activating-indicator')
    ).toBeTruthy();
    expect(document.querySelector('.notebook-row-activating')).toBeTruthy();
  });

  it('does not navigate when an activating row is clicked', () => {
    const keys = [`${listed.serverId}:${listed.projectId}`];
    renderGrid({
      projects: [listed],
      activatingProjectKeys: keys,
    });

    fireEvent.click(screen.getByText('Creek survey'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates when a ready Active row is clicked', () => {
    renderGrid({projects: [ready]});

    fireEvent.click(screen.getByText('Ready survey'));
    expect(navigate).toHaveBeenCalledWith(
      ROUTES.getNotebookRoute({
        serverId: ready.serverId,
        projectId: ready.projectId,
      })
    );
  });
});
