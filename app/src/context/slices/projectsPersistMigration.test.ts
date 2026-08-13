import fs from 'fs';
import path from 'path';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../store', () => ({
  store: {
    getState: vi.fn(),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {migrateProjectsPersistedState} from './projectsPersistMigration';
import {migrateProjectsSyncModeV2} from './projectsPersistMigration';

const buildCompiledSpecId = ({
  projectId,
  serverId,
}: {
  projectId: string;
  serverId: string;
}) => `${serverId}-${projectId}`;

const legacyNotebookPath = path.join(
  __dirname,
  '../../../../api/notebooks/sample_notebook.legacy.json'
);

describe('migrateProjectsPersistedState', () => {
  it('migrates legacy persisted metadata + rawUiSpecification to uiDefinition', () => {
    const legacy = JSON.parse(fs.readFileSync(legacyNotebookPath, 'utf-8'));
    const projectId = 'proj-legacy';
    const serverId = 'server-a';
    const state = {
      isInitialised: true,
      servers: {
        [serverId]: {
          serverId,
          serverUrl: 'https://example.test',
          serverTitle: 'Test',
          shortCodePrefix: 'T',
          description: '',
          projects: {
            [projectId]: {
              projectId,
              serverId,
              name: 'Legacy survey',
              isActivated: false,
              status: ProjectStatus.OPEN,
              uiSpecificationId: buildCompiledSpecId({projectId, serverId}),
              metadata: legacy.metadata,
              rawUiSpecification: {
                fields: legacy['ui-specification'].fields,
                views: legacy['ui-specification'].fviews,
                viewsets: legacy['ui-specification'].viewsets,
                visible_types: legacy['ui-specification'].visible_types,
              },
            },
          },
        },
      },
    };

    const migrated = migrateProjectsPersistedState(state);
    const project = migrated.servers[serverId]?.projects[projectId];
    expect(project).toBeDefined();
    expect(project!.uiDefinition.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(
      project!.uiDefinition.metadata.information.purposeMarkdown
    ).toContain('Nellies Glen');
    expect(project).not.toHaveProperty('metadata');
    expect(project).not.toHaveProperty('rawUiSpecification');
    expect(migrated.isInitialised).toBe(false);
  });

  it('re-normalizes projects that already have uiDefinition', () => {
    const projectId = 'p1';
    const serverId = 's1';
    const uiDefinition = migrateProjectsPersistedState({
      servers: {
        [serverId]: {
          serverId,
          serverUrl: 'https://x.test',
          serverTitle: 'X',
          shortCodePrefix: 'X',
          description: '',
          projects: {
            [projectId]: {
              projectId,
              serverId,
              name: 'N',
              description: 'D',
              isActivated: false,
              status: ProjectStatus.OPEN,
              uiSpecificationId: buildCompiledSpecId({projectId, serverId}),
              metadata: {pre_description: 'old'},
              rawUiSpecification: {
                fields: {},
                views: {},
                viewsets: {},
                visible_types: [],
              },
            },
          },
        },
      },
    }).servers[serverId]!.projects[projectId]!.uiDefinition;

    const state = {
      isInitialised: true,
      servers: {
        [serverId]: {
          serverId,
          serverUrl: 'https://x.test',
          serverTitle: 'X',
          shortCodePrefix: 'X',
          description: '',
          projects: {
            [projectId]: {
              projectId,
              serverId,
              name: 'N',
              description: 'D',
              isActivated: false,
              status: ProjectStatus.OPEN,
              uiSpecificationId: buildCompiledSpecId({projectId, serverId}),
              uiDefinition,
            },
          },
        },
      },
    };

    const again = migrateProjectsPersistedState(state);
    expect(
      again.servers[serverId]!.projects[projectId]!.uiDefinition.uiSpec
        .schemaVersion
    ).toBe(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION);
  });
});

describe('migrateProjectsSyncModeV2', () => {
  it('maps legacy isSyncing boolean to syncMode', () => {
    const migrated = migrateProjectsSyncModeV2({
      isInitialised: true,
      servers: {
        'server-a': {
          serverId: 'server-a',
          serverUrl: 'https://example.test',
          serverTitle: 'Test',
          shortCodePrefix: 'T',
          description: '',
          projects: {
            off: {
              projectId: 'off',
              serverId: 'server-a',
              name: 'Off',
              isActivated: true,
              status: ProjectStatus.OPEN,
              uiSpecificationId: 'x',
              uiDefinition: {
                uiSpec: {
                  fields: {},
                  views: {},
                  viewsets: {},
                  visible_types: [],
                },
                metadata: {
                  information: {purposeMarkdown: ''},
                  branding: {},
                },
              },
              database: {
                localDbId: 'local',
                isSyncing: false,
                isSyncingAttachments: false,
                remote: {
                  remoteDbId: 'remote',
                  syncId: undefined,
                  connectionConfiguration: {
                    jwtToken: 't',
                    couchUrl: 'https://couch',
                    databaseName: 'data-x',
                  },
                },
              },
            },
            on: {
              projectId: 'on',
              serverId: 'server-a',
              name: 'On',
              isActivated: true,
              status: ProjectStatus.OPEN,
              uiSpecificationId: 'y',
              uiDefinition: {
                uiSpec: {
                  fields: {},
                  views: {},
                  viewsets: {},
                  visible_types: [],
                },
                metadata: {
                  information: {purposeMarkdown: ''},
                  branding: {},
                },
              },
              database: {
                localDbId: 'local2',
                isSyncing: true,
                isSyncingAttachments: true,
                remote: {
                  remoteDbId: 'remote2',
                  syncId: 'sync',
                  connectionConfiguration: {
                    jwtToken: 't',
                    couchUrl: 'https://couch',
                    databaseName: 'data-y',
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(migrated.servers['server-a']!.projects.off!.database!.syncMode).toBe(
      'none'
    );
    expect(migrated.servers['server-a']!.projects.on!.database!.syncMode).toBe(
      'both'
    );
  });
});
