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
    expect(
      again.servers[serverId]!.projects[projectId]!.schemaCompatibility?.tier
    ).toBe('compatible');
  });

  it('keeps (does not drop) a project whose design this build cannot read', () => {
    const serverId = 's1';
    const server = {
      serverId,
      serverUrl: 'https://x.test',
      serverTitle: 'X',
      shortCodePrefix: 'X',
      description: '',
    };
    const [major] = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.split('.').map(Number);
    const state = {
      isInitialised: true,
      servers: {
        [serverId]: {
          ...server,
          projects: {
            // uiDefinition at a newer major than this build understands
            newer: {
              projectId: 'newer',
              serverId,
              name: 'Newer',
              isActivated: true,
              status: ProjectStatus.OPEN,
              uiSpecificationId: buildCompiledSpecId({
                projectId: 'newer',
                serverId,
              }),
              uiDefinition: {
                uiSpec: {
                  fields: {},
                  views: {},
                  viewsets: {},
                  visible_types: [],
                  settings: {showQrCodeButton: false},
                  schemaVersion: `${major + 1}.0.0`,
                },
                metadata: {information: {}},
              },
            },
            // legacy fields that fail the collapse migration
            broken: {
              projectId: 'broken',
              serverId,
              name: 'Broken',
              isActivated: true,
              status: ProjectStatus.OPEN,
              uiSpecificationId: buildCompiledSpecId({
                projectId: 'broken',
                serverId,
              }),
              metadata: {schema_version: '3.0'},
              rawUiSpecification: {
                fields: {bad: 'nope'},
                views: {},
                viewsets: {},
                visible_types: [],
              },
            },
          },
        },
      },
    };

    const migrated = migrateProjectsPersistedState(state);
    const projects = migrated.servers[serverId]!.projects;
    expect(Object.keys(projects).sort()).toEqual(['broken', 'newer']);
    expect(projects.newer!.schemaCompatibility?.tier).toBe('incompatible');
    expect(projects.newer!.schemaCompatibility?.relation).toBe('newer-major');
    expect(projects.newer!.isActivated).toBe(true);
    expect(projects.broken!.schemaCompatibility?.tier).toBe('incompatible');
    expect(projects.broken!.uiDefinition.uiSpec.fields).toEqual({});
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
