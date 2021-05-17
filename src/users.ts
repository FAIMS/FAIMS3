import {active_db} from './sync/index';

export async function getFriendlyUserName(
  project_name: string
): Promise<string> {
  const doc = await active_db.get(project_name);
  if (doc.friendly_name === undefined) {
    return doc.username;
  }
  return doc.friendly_name;
}

export async function getCurrentUserId(project_name: string): Promise<string> {
  const doc = await active_db.get(project_name);
  return doc.username;
}
