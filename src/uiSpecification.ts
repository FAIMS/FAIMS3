import {getProjectDB} from './sync/index';
import {UI_SPECIFICATION_NAME, ProjectUIModel} from './datamodel';

export async function getUiSpecForProject(
  project_name: string
): ProjectUIModel {
  const projdb = getProjectDB(project_name);
  try {
    return projdb.get(UI_SPECIFICATION_NAME);
  } catch (err) {
    console.warn(err);
    throw Error('failed to find ui specification');
  }
}

export function setUiSpecForProject(
  project_name: string,
  uiInfo: ProjectUIModel
) {
  const projdb = getProjectDB(project_name);
  try {
    return projdb.put(uiInfo);
  } catch (err) {
    console.warn(err);
    throw Error('failed to set ui specification');
  }
}
