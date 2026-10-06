// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Project} from '../../../context/slices/projectSlice';
import {theme} from '../../themes';
import MetadataRenderer from '../metadataRenderer';
import {MetadataDisplayComponent} from './MetadataDisplay';

const listedProject = {
  projectId: 'listed-project',
  serverId: 's',
  name: 'Listed Name',
  description: 'Listed description',
  status: ProjectStatus.OPEN,
  isActivated: false,
  updatedAt: '2024-02-01T00:00:00.000Z',
  uiSpecProperties: {
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    hash: 'a'.repeat(64),
  },
} as Project;

const activatedProject = {
  ...listedProject,
  projectId: 'activated-project',
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
        notebookVersion: '2.1',
        purposeMarkdown: 'Why we survey',
        projectLeadLabel: 'Lead Name',
        leadInstitution: 'Uni',
      },
    },
  },
} as Project;

vi.mock('../../../context/store', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      projects: {
        servers: {
          s: {
            listed: {
              'listed-project': listedProject,
            },
            activated: {
              'activated-project': activatedProject,
            },
          },
        },
      },
    }),
}));

vi.mock('@faims3/forms', async () => ({
  ...(await vi.importActual<object>('@faims3/forms')),
  RichTextContent: ({content}: {content: string}) => (
    <span data-testid="rich-text">{content}</span>
  ),
}));

afterEach(cleanup);

const renderDisplay = (project: Project) => {
  return render(
    <ThemeProvider theme={theme}>
      <MetadataDisplayComponent project={project} />
    </ThemeProvider>
  );
};

describe('MetadataDisplay listed notebook (no uiDefinition)', () => {
  it('shows listing name and description without reading a form graph', () => {
    expect(listedProject).not.toHaveProperty('uiDefinition');
    renderDisplay(listedProject);

    expect(screen.getByText('Listed Name')).toBeInTheDocument();
    expect(screen.getByText('Listed description')).toBeInTheDocument();
    expect(screen.getByText('2024-02-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Uni')).toBeNull();
    expect(screen.queryByText('Lead Name')).toBeNull();
    expect(screen.queryByText('Why we survey')).toBeNull();
  });
});

describe('MetadataDisplay activated notebook', () => {
  it('reads design metadata from uiDefinition', () => {
    renderDisplay(activatedProject);

    expect(screen.getByText('Listed Name')).toBeInTheDocument();
    expect(screen.getAllByText('Uni').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lead Name').length).toBeGreaterThan(0);
    expect(screen.getByText('2.1')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text')).toHaveTextContent('Why we survey');
  });
});

describe('MetadataRenderer listed vs activated', () => {
  it('renders nothing from information fields on a listed notebook', () => {
    render(
      <ThemeProvider theme={theme}>
        <MetadataRenderer
          project_id="listed-project"
          informationField="leadInstitution"
          chips={false}
        />
      </ThemeProvider>
    );
    expect(screen.queryByText('Uni')).toBeNull();
  });

  it('reads information fields from the activated design', () => {
    render(
      <ThemeProvider theme={theme}>
        <MetadataRenderer
          project_id="activated-project"
          informationField="leadInstitution"
          chips={false}
        />
      </ThemeProvider>
    );
    expect(screen.getByText('Uni')).toBeInTheDocument();
  });
});
