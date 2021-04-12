import {getProjectDB} from './sync/index';
import {UI_SPECIFICATION_NAME} from './datamodel';

export function getUiSpecForProject(project_name: string) {
  const projdb = getProjectDB(project_name);
  return projdb
    .get(UI_SPECIFICATION_NAME)
    .then(doc => {
      return doc;
    })
    .catch(err => {
      console.log(err);
      return {};
    });
}
