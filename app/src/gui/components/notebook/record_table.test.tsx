// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NotebookRouteProvider} from '../../../context/notebookRoute';
import {Project} from '../../../context/slices/projectSlice';
import {theme} from '../../themes';
import {RecordsTable} from './record_table';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => vi.fn(),
  useParams: () => ({serverId: 's', projectId: 'p'}),
}));
vi.mock('../../../context/store', () => ({
  useAppSelector: () => ({username: 'testuser', parsedToken: {}}),
}));
vi.mock('../../../context/slices/authSlice', () => ({
  selectActiveUser: vi.fn(),
}));
vi.mock('../../../utils/database', () => ({localGetDataDb: () => ({})}));
vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {getSpec: () => undefined},
}));

const listedProject = {
  projectId: 'p',
  serverId: 's',
  name: 'Listed',
  status: ProjectStatus.OPEN,
  isActivated: false,
  uiSpecProperties: {
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    hash: 'a'.repeat(64),
  },
} as Project;

const activatedProject = {
  ...listedProject,
  isActivated: true,
  uiSpecificationId: 'spec',
  uiDefinition: {
    uiSpec: {
      fields: {},
      views: {},
      viewsets: {},
      visible_types: [],
      settings: {showQrCodeButton: false},
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    },
    metadata: {
      information: {
        notebookVersion: '',
        purposeMarkdown: '',
        projectLeadLabel: '',
        leadInstitution: '',
      },
    },
  },
} as Project;

const renderTable = (project: Project) =>
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <NotebookRouteProvider>
          <RecordsTable
            project={project}
            maxRows={null}
            rows={[]}
            loading={false}
            handleQueryFunction={vi.fn()}
            handleRefresh={vi.fn()}
            recordLabel="Record"
          />
        </NotebookRouteProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );

afterEach(cleanup);

describe('RecordsTable listed notebook (no uiDefinition)', () => {
  it('shows a loading state instead of the grid when there is no compiled spec', () => {
    renderTable(listedProject);
    expect(listedProject).not.toHaveProperty('uiDefinition');
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('also waits when an activated notebook has no compiled spec on device', () => {
    renderTable(activatedProject);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});
