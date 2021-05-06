import {getProjectDB} from './sync/index';
import {
  UI_SPECIFICATION_NAME,
  ProjectUIModel,
  EncodedProjectUIModel,
  ProjectsList,
} from './datamodel';

export async function getUiSpecForProject(
  project_name: string
): Promise<ProjectUIModel> {
  const projdb = getProjectDB(project_name);
  try {
    const encUIInfo: EncodedProjectUIModel = await projdb.get(
      UI_SPECIFICATION_NAME
    );
    return {
      _id: encUIInfo._id,
      _rev: encUIInfo._rev,
      fields: encUIInfo.fields,
      views: encUIInfo.fviews,
      start_view: encUIInfo.start_view,
    };
  } catch (err) {
    console.warn(err);
    throw Error('failed to find ui specification');
  }
}

export type SyncingUiSpecs = {
  [key: string]:
    | {uiSpec: null; error: undefined; promise: Promise<unknown>}
    | {uiSpec: null; error: unknown}
    | {uiSpec: ProjectUIModel; error: undefined};
};

/**
 * Creates a SyncingUiSpecs for use in the React element just above the individual project forms.
 * @param projects List of projects that have meta dbs created (possibly not synced yet, though)
 * @param existingSync An already existing SyncingUiSpecs to update (instead of create new)
 * @param onUpdate this is called when any of the promises resolve.
 * @returns An updated SyncingUiSpecs object to use with the tabbed forms GUI element
 */
export function syncUISpecs(
  projects: ProjectsList,
  onUpdate: (uiSpec: SyncingUiSpecs) => unknown,
  existingSync: SyncingUiSpecs = {}
): SyncingUiSpecs {
  for (const name in projects) {
    if (!(name in existingSync)) {
      // PROJECT by active_id name is NEW PROJECT and should start syncing
      existingSync[name] = {
        uiSpec: null,
        error: undefined,
        promise: getUiSpecForProject(name)
          .then(uiSpec => {
            existingSync[name] = {uiSpec: uiSpec, error: undefined};
            onUpdate(existingSync);
          })
          .catch(error => {
            existingSync[name] = {uiSpec: null, error: error};
            onUpdate(existingSync);
          }),
      };
    }
  }

  for (const name in existingSync) {
    if (!(name in projects)) {
      // PROJECT by active_id name is DELETED PROJECT and should stop syncing & be removed

      delete existingSync[name];
    }
  }

  return existingSync;
}

export async function setUiSpecForProject(
  project_name: string,
  uiInfo: ProjectUIModel
) {
  const projdb = getProjectDB(project_name);
  const encUIInfo: EncodedProjectUIModel = {
    _id: UI_SPECIFICATION_NAME,
    fields: uiInfo.fields,
    fviews: uiInfo.views,
    start_view: uiInfo.start_view,
  };
  try {
    const existing_encUIInfo = await projdb.get(encUIInfo._id);
    encUIInfo._rev = existing_encUIInfo._rev;
  } catch (err) {
    // Probably no existing UI info
  }

  try {
    return await projdb.put(encUIInfo);
  } catch (err) {
    console.warn(err);
    throw Error('failed to set ui specification');
  }
}
