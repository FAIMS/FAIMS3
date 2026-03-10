import {
  type DataDocument,
  type DatabaseInterface,
  compileUiSpecConditionals,
  decodeCouchUiSpec,
  type EncodedProjectUIModel,
  type GetNotebookResponse,
  type UISpecification,
} from '@faims3/data-model';
import {
  createDataEngine,
  createLocalDb,
  createOneWaySync,
  type DashboardProjectRuntime,
} from '../dashboard-db';
import {fetchProjectDetails} from '../api-client';
import {COUCHDB_URL} from '../constants';
import type {User} from '../auth-context';

export interface DashboardProjectContextValue {
  getOrCreateRuntime: (
    projectId: string,
    user: User
  ) => Promise<DashboardProjectRuntime>;
  getRuntime: (projectId: string) => DashboardProjectRuntime | undefined;
}

const runtimes = new Map<string, DashboardProjectRuntime>();

export function getDashboardProjectContextValue(): DashboardProjectContextValue {
  return {
    async getOrCreateRuntime(projectId: string, user: User) {
      const existing = runtimes.get(projectId);
      if (existing) return existing;

      const details: GetNotebookResponse = await fetchProjectDetails({
        projectId,
        user,
      });

      const encodedSpec = details['ui-specification'] as unknown as EncodedProjectUIModel;
      const uiSpec = decodeCouchUiSpec(encodedSpec);
      // Required for forms DataView: compile condition expressions into `conditionFn`
      compileUiSpecConditionals(uiSpec);
      const databaseName = `data-${projectId}`;

      const localDb = createLocalDb(projectId);
      const syncHandle = createOneWaySync({
        couchUrl: COUCHDB_URL,
        databaseName,
        token: user.token,
        localDb: localDb as unknown as DatabaseInterface<DataDocument>,
      });

      const engine = createDataEngine({
        localDb: localDb as unknown as DatabaseInterface<DataDocument>,
        uiSpec: uiSpec as UISpecification,
      });

      const runtime: DashboardProjectRuntime = {
        projectId,
        engine,
        localDb: localDb as unknown as DatabaseInterface<DataDocument>,
        syncHandle,
      };

      runtimes.set(projectId, runtime);
      return runtime;
    },

    getRuntime(projectId: string) {
      return runtimes.get(projectId);
    },
  };
}
