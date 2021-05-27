import {active_db} from './sync/index';
import {ProjectID} from './datamodel';

export async function getFriendlyUserName(
  project_id: ProjectID
): Promise<string> {
  const doc = await active_db.get(project_id);
  if (doc.friendly_name === undefined) {
    return doc.username;
  }
  return doc.friendly_name;
}

export async function getCurrentUserId(project_id: ProjectID): Promise<string> {
  const doc = await active_db.get(project_id);
  return doc.username;
}
