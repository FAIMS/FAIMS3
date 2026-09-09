import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestWrapper} from '../../testUtils';

const specs = new Map<string, unknown>();
const compileErrors = new Map<string, string>();

vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {
    getSpec: (id: string) => specs.get(id),
    getCompileError: (id: string) => compileErrors.get(id),
    compileAndRegisterSpec: vi.fn(),
    removeSpec: vi.fn(),
  },
}));

vi.mock('./MetadataDisplay', () => ({
  MetadataDisplayComponent: () => <div data-testid="metadata-display" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) satisfies Object;
  return {
    ...actual,
    useParams: () => ({tab: undefined}),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

import {NotebookView} from './notebookView';
import type {Project} from '../../../context/slices/projectSlice';

afterEach(() => {
  cleanup();
  specs.clear();
  compileErrors.clear();
});

const baseProject = (): Project => ({
  projectId: 'test-project',
  serverId: 'test-server',
  name: 'Test Name',
  status: ProjectStatus.OPEN,
  isActivated: true,
  uiSpecificationId: 'spec-1',
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
});

describe('NotebookView fail-soft tiers', () => {
  it('shows the skeleton + copyable report for an incompatible notebook, not a spinner', () => {
    const project = baseProject();
    project.schemaCompatibility = {
      tier: 'incompatible',
      relation: 'newer-major',
      appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      notebookSchemaVersion: '99.0.0',
      requiresMigration: false,
      reason: 'Notebook schemaVersion 99.0.0 has a newer major version',
    };

    act(() => {
      render(
        <TestWrapper>
          <NotebookView project={project} />
        </TestWrapper>
      );
    });

    expect(
      screen.getByTestId('notebook-schema-incompatible-view')
    ).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
    const report =
      screen.getByTestId('notebook-compatibility-report').textContent ?? '';
    expect(report).toContain('test-project');
    expect(report).toContain('schemaVersion: 99.0.0');
    expect(report).toContain(
      `App schemaVersion: ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}`
    );
    expect(report).toContain('Tier: incompatible');
    expect(
      screen.getByTestId('notebook-compatibility-copy-report')
    ).toBeTruthy();
    expect(
      screen.getByTestId('notebook-schema-chip-incompatible')
    ).toBeTruthy();
  });

  it('shows the skeleton with the compile error when the spec failed to compile', () => {
    const project = baseProject();
    compileErrors.set('spec-1', 'Unknown operator "frobnicate"');

    act(() => {
      render(
        <TestWrapper>
          <NotebookView project={project} />
        </TestWrapper>
      );
    });

    expect(
      screen.getByTestId('notebook-schema-incompatible-view')
    ).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
    expect(
      screen.getByTestId('notebook-compatibility-report').textContent
    ).toContain('frobnicate');
  });

  it('shows a spinner briefly, then the skeleton, when no compiled spec and no error exist', () => {
    vi.useFakeTimers();
    try {
      const project = baseProject();
      act(() => {
        render(
          <TestWrapper>
            <NotebookView project={project} />
          </TestWrapper>
        );
      });
      expect(
        screen.queryByTestId('notebook-schema-incompatible-view')
      ).toBeNull();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(
        screen.getByTestId('notebook-schema-incompatible-view')
      ).toBeTruthy();
      expect(
        screen.getByTestId('notebook-compatibility-report').textContent
      ).toContain('not available on this device');
    } finally {
      vi.useRealTimers();
    }
  });
});
