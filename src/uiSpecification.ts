import {getProjectDB} from './sync/index';
import {
  UI_SPECIFICATION_NAME,
  ProjectUIModel,
  EncodedProjectUIModel,
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
  if (uiInfo['_rev'] !== undefined) {
    encUIInfo['_rev'] = uiInfo['_rev'];
  }

  try {
    return await projdb.put(encUIInfo);
  } catch (err) {
    console.warn(err);
    throw Error('failed to set ui specification');
  }
}
