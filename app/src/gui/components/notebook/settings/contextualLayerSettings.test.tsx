// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import {
  DEFAULT_MAP_ASSET_STYLE,
  type ContextualLayerListing,
} from '@faims3/data-model';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as ROUTES from '../../../../constants/routes';
import type {Project} from '../../../../context/slices/projectSlice';
import {setPendingContextualLayerPrompt} from '../../../../context/slices/projectSlice';
import type {StoredContextualLayerSummary} from '../../maps/contextualLayerStore';

const SURVEY_PATH = '/notebooks/server-1/survey-1';

const harness = vi.hoisted(() => ({
  dispatch: vi.fn(),
  navigate: vi.fn(),
  stored: [] as StoredContextualLayerSummary[],
  listError: undefined as Error | undefined,
}));

vi.mock('../../../../context/store', () => ({
  useAppDispatch: () => harness.dispatch,
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom'
    );
  return {
    ...actual,
    useNavigate: () => harness.navigate,
    useLocation: () => ({pathname: SURVEY_PATH, search: ''}),
  };
});

vi.mock('../../maps/contextualLayerStore', () => ({
  CONTEXTUAL_LAYERS_CHANGED_EVENT: 'contextual-layers-changed',
  listStoredContextualLayers: () =>
    harness.listError
      ? Promise.reject(harness.listError)
      : Promise.resolve([...harness.stored]),
}));

import NotebookContextualLayerSettings from './contextualLayerSettings';

function layer(
  id: string,
  name: string,
  contentHash = 'hash-a'
): ContextualLayerListing {
  return {
    id,
    name,
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    extent: [0, 0, 1, 1],
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
  };
}

function stored(
  assetId: string,
  name: string,
  contentHash = 'hash-a'
): StoredContextualLayerSummary {
  return {
    assetId,
    name,
    kind: 'vector-tiles',
    byteSize: 2048,
    contentHash,
    extent4326: [0, 0, 1, 1],
  };
}

function projectWith(
  contextualLayers: ContextualLayerListing[] | undefined
): Project {
  return {
    projectId: 'survey-1',
    serverId: 'server-1',
    contextualLayers,
  } as Project;
}

function renderSettings(project: Project) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <NotebookContextualLayerSettings project={project} />
    </ThemeProvider>
  );
}

const twoLayers = () => [
  layer('asset-1', 'Site boundaries'),
  layer('asset-2', 'Vegetation'),
];

const managerRoute = ROUTES.getOfflineMapLayersRoute({from: SURVEY_PATH});

describe('NotebookContextualLayerSettings', () => {
  beforeEach(() => {
    harness.dispatch.mockReset();
    harness.navigate.mockReset();
    harness.stored = [];
    harness.listError = undefined;
  });

  it('renders nothing when the survey has no linked map layers', () => {
    const {container} = renderSettings(projectWith([]));
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-settings')
    ).not.toBeInTheDocument();
  });

  it('renders nothing when linked layers are unknown', () => {
    const {container} = renderSettings(projectWith(undefined));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the incomplete banner and both actions when no layers are on this device', async () => {
    renderSettings(projectWith(twoLayers()));

    expect(
      screen.getByTestId('app-notebook-contextual-layers-settings')
    ).toBeInTheDocument();
    expect(screen.queryByText(/map layers are linked/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Click below to manage layer downloads\./)
    ).not.toBeInTheDocument();

    const banner = await screen.findByTestId(
      'app-notebook-contextual-layers-incomplete'
    );
    expect(banner).toHaveTextContent(
      '2 map layers available (4 KB). 0/2 layers downloaded.'
    );
    expect(banner).toHaveClass('MuiAlert-colorInfo');
    expect(
      screen.getByTestId('app-notebook-contextual-layers-manage')
    ).toHaveTextContent('Manage Layers');
    expect(
      screen.getByTestId('app-notebook-contextual-layers-open-prompt')
    ).toHaveTextContent('Download Layers');
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-downloaded')
    ).not.toBeInTheDocument();
  });

  it('opens the download prompt from Download Layers', async () => {
    const user = userEvent.setup();
    renderSettings(projectWith(twoLayers()));

    await user.click(
      await screen.findByTestId('app-notebook-contextual-layers-open-prompt')
    );

    expect(harness.dispatch).toHaveBeenCalledWith(
      setPendingContextualLayerPrompt({
        projectId: 'survey-1',
        serverId: 'server-1',
      })
    );
  });

  it('opens the map-layer manager with a return hint from Manage Layers', async () => {
    const user = userEvent.setup();
    renderSettings(projectWith(twoLayers()));

    await user.click(
      await screen.findByTestId('app-notebook-contextual-layers-manage')
    );

    expect(harness.navigate).toHaveBeenCalledWith(managerRoute);
  });

  it('shows the green all-downloaded status and Manage Downloads', async () => {
    harness.stored = [
      stored('asset-1', 'Site boundaries'),
      stored('asset-2', 'Vegetation'),
    ];
    renderSettings(projectWith(twoLayers()));

    const status = await screen.findByTestId(
      'app-notebook-contextual-layers-downloaded'
    );
    expect(status).toHaveTextContent('All map layers downloaded');
    expect(status).toHaveClass('MuiAlert-colorSuccess');
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-incomplete')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Download Layers')).not.toBeInTheDocument();

    expect(
      screen.getByTestId('app-notebook-contextual-layers-manage')
    ).toHaveTextContent('Manage Downloads');
  });

  it('opens the map-layer manager with a return hint when all downloaded', async () => {
    const user = userEvent.setup();
    harness.stored = [
      stored('asset-1', 'Site boundaries'),
      stored('asset-2', 'Vegetation'),
    ];
    renderSettings(projectWith(twoLayers()));

    await user.click(
      await screen.findByTestId('app-notebook-contextual-layers-manage')
    );

    expect(harness.navigate).toHaveBeenCalledWith(managerRoute);
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it('shows how many of the available layers are downloaded', async () => {
    harness.stored = [stored('asset-1', 'Site boundaries')];
    renderSettings(projectWith(twoLayers()));

    const banner = await screen.findByTestId(
      'app-notebook-contextual-layers-incomplete'
    );
    expect(banner).toHaveTextContent(
      '2 map layers available (4 KB). 1/2 layers downloaded (2 KB).'
    );
    expect(
      screen.getByTestId('app-notebook-contextual-layers-manage')
    ).toHaveTextContent('Manage Layers');
    expect(
      screen.getByTestId('app-notebook-contextual-layers-open-prompt')
    ).toHaveTextContent('Download Layers');
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-downloaded')
    ).not.toBeInTheDocument();
  });

  it('treats an outdated stored layer as not downloaded', async () => {
    harness.stored = [
      stored('asset-1', 'Site boundaries', 'hash-old'),
      stored('asset-2', 'Vegetation'),
    ];
    renderSettings(projectWith(twoLayers()));

    const banner = await screen.findByTestId(
      'app-notebook-contextual-layers-incomplete'
    );
    expect(banner).toHaveTextContent(
      '2 map layers available (4 KB). 1/2 layers downloaded (2 KB).'
    );
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-downloaded')
    ).not.toBeInTheDocument();
  });

  it('refreshes to the green status when layers finish downloading', async () => {
    renderSettings(projectWith(twoLayers()));

    await screen.findByTestId('app-notebook-contextual-layers-incomplete');

    harness.stored = [
      stored('asset-1', 'Site boundaries'),
      stored('asset-2', 'Vegetation'),
    ];
    act(() => {
      dispatchEvent(new Event('contextual-layers-changed'));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('app-notebook-contextual-layers-downloaded')
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('Download Layers')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('app-notebook-contextual-layers-manage')
    ).toHaveTextContent('Manage Downloads');
  });

  it('keeps the incomplete actions when stored layers cannot be read', async () => {
    harness.listError = new Error('Could not read map layers.');
    renderSettings(projectWith(twoLayers()));

    const banner = await screen.findByTestId(
      'app-notebook-contextual-layers-incomplete'
    );
    expect(banner).toHaveTextContent(
      '2 map layers available (4 KB). 0/2 layers downloaded.'
    );
    expect(
      screen.getByTestId('app-notebook-contextual-layers-open-prompt')
    ).toHaveTextContent('Download Layers');
    expect(
      screen.queryByTestId('app-notebook-contextual-layers-downloaded')
    ).not.toBeInTheDocument();
  });
});
