// SPDX-License-Identifier: Apache-2.0
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../../../context/slices/projectSlice';
import {config} from '../../../../buildconfig';

const harness = vi.hoisted(() => ({
  isOnline: true,
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
        },
      },
    }),
}));

vi.mock('../../../../context/slices/projectSlice', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../../../context/slices/projectSlice')
    >();
  return {
    ...actual,
    activateProject: (payload: unknown) => ({
      type: 'projects/activateProject',
      payload,
    }),
  };
});

import NotebookActivationSwitch from './activation-switch';

const listedProject = {
  projectId: 'survey-1',
  serverId: 'server-1',
  isActivated: false,
  name: 'Creek survey',
} as Project;

function renderSwitch(project: Project = listedProject) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <NotebookActivationSwitch
        project={project}
        isWorking={false}
        setTabID={vi.fn()}
      />
    </ThemeProvider>
  );
}

describe('NotebookActivationSwitch', () => {
  beforeEach(() => {
    harness.isOnline = true;
    harness.dispatch.mockReset();
  });

  it('lets the user confirm activation while online', () => {
    renderSwitch();
    const activate = screen.getByTestId(
      'app-notebook-activate-button'
    ) as HTMLButtonElement;
    expect(activate.disabled).toBe(false);
    fireEvent.click(activate);
    const confirm = screen.getByTestId(
      'app-notebook-activate-confirm'
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(
      screen.queryByTestId('app-notebook-activate-offline-warning')
    ).toBeNull();
    fireEvent.click(confirm);
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: 'projects/activateProject',
      payload: {
        jwtToken: 'token',
        projectId: 'survey-1',
        serverId: 'server-1',
      },
    });
  });

  it('disables activation while offline', () => {
    harness.isOnline = false;
    renderSwitch();
    const activate = screen.getByTestId(
      'app-notebook-activate-button'
    ) as HTMLButtonElement;
    expect(activate.disabled).toBe(true);
    fireEvent.mouseOver(activate);
    expect(
      screen.getByLabelText(
        `Connect to the internet to activate this ${config.notebookName}. Activation prepares the ${config.notebookName} for offline use.`
      )
    ).toBeTruthy();
    fireEvent.click(activate);
    expect(screen.queryByTestId('app-notebook-activate-confirm')).toBeNull();
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it('warns and blocks confirm if the connection drops while the dialog is open', () => {
    const view = renderSwitch();
    fireEvent.click(screen.getByTestId('app-notebook-activate-button'));
    expect(screen.getByTestId('app-notebook-activate-confirm')).toBeTruthy();

    harness.isOnline = false;
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <NotebookActivationSwitch
          project={listedProject}
          isWorking={false}
          setTabID={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(
      screen.getByTestId('app-notebook-activate-offline-warning').textContent
    ).toBe(
      `Connect to the internet to activate this ${config.notebookName}. Activation prepares the ${config.notebookName} for offline use.`
    );
    expect(
      (screen.getByTestId('app-notebook-activate-confirm') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByTestId('app-notebook-activate-confirm'));
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it('keeps schema-blocked notebooks disabled even when online', () => {
    renderSwitch({
      ...listedProject,
      schemaCompatibility: {
        tier: 'incompatible',
        relation: 'newer-major',
        appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
        requiresMigration: false,
        reason: 'Needs app update',
      },
    } as Project);
    expect(
      (screen.getByTestId('app-notebook-activate-button') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
