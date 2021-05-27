import {getProjectDB} from './sync';
import PouchDB from 'pouchdb';
import {ProjectMetaObject, ProjectID} from './datamodel';
import {
  UI_SPECIFICATION_NAME,
  ProjectUIModel,
  EncodedProjectUIModel,
} from './datamodel';

export async function getUiSpecForProject(
  project_id: ProjectID
): Promise<ProjectUIModel> {
  const projdb = getProjectDB(project_id);
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
  projdb: PouchDB.Database<ProjectMetaObject>,
  uiInfo: ProjectUIModel
) {
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
