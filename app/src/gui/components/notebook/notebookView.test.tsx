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

// Read-only browsing test: stub the data-layer hooks NotebookViewWithSpec
// needs, and register a plan view that echoes the create permission it is
// handed so the gating can be asserted without a live record list.
vi.mock('../../../utils/customHooks', () => ({
  useIsAuthorisedTo: () => true,
  useIsRecordDownloadUnderway: () => false,
  usePlanRecordStatusReports: () => ({}),
  useRecordList: () => ({
    allRecords: [],
    myRecords: [],
    otherRecords: [],
    isLoading: false,
    canReadAllRecords: true,
    refetch: vi.fn(),
  }),
  invalidateProjectRecordList: vi.fn(),
  invalidateProjectHydration: vi.fn(),
}));
vi.mock('../../../utils/apiHooks/notebooks', () => ({
  useRecordAudit: () => ({data: undefined}),
}));
vi.mock('../../../utils/database', () => ({
  localGetDataDb: () => ({}),
}));
vi.mock('./plans', () => ({
  getNotebookView: () => (props: any) => (
    <div data-testid="plan-view">
      create-allowed:{String(props.status.isAllowedToAddRecords)}
    </div>
  ),
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

  it('incompatible with a last good design: banner + read-only records, create blocked', () => {
    const project = baseProject();
    // A real (non-placeholder) last good graph is stored locally
    project.uiDefinition.uiSpec.fields = {
      title: {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Title', name: 'title'},
      },
    } as any;
    project.uiDefinition.uiSpec.views = {s1: {fields: ['title'], label: 'S'}};
    project.uiDefinition.uiSpec.viewsets = {f1: {views: ['s1'], label: 'F'}};
    project.uiDefinition.uiSpec.visible_types = ['f1'];
    project.schemaCompatibility = {
      tier: 'incompatible',
      relation: 'newer-major',
      appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      notebookSchemaVersion: '99.0.0',
      requiresMigration: false,
      reason: 'Notebook schemaVersion 99.0.0 has a newer major version',
    };
    specs.set('spec-1', {
      ...project.uiDefinition.uiSpec,
      conditionFns: {},
    });

    act(() => {
      render(
        <TestWrapper>
          <NotebookView project={project} />
        </TestWrapper>
      );
    });

    // Banner + report still present …
    expect(
      screen.getByTestId('notebook-schema-incompatible-view')
    ).toBeTruthy();
    expect(
      screen.getByTestId('notebook-compatibility-copy-report')
    ).toBeTruthy();
    // … but the record list renders (read-only) instead of "unavailable"
    expect(screen.queryByText(/record list is unavailable/i)).toBeNull();
    expect(screen.getByTestId('plan-view').textContent).toContain(
      'create-allowed:false'
    );
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
