/* eslint-disable n/no-process-exit */
import {createNotebook} from '../couchdb/notebooks';
import {readFileSync} from 'fs';

const extension = (filename: string) => {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
};

const loadNotebook = async (filename: string) => {
  try {
    console.log('loading', filename);
    const jsonText = readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const projectName = metadata.name;

    const projectID = await createNotebook(projectName, uiSpec, metadata);
    console.log('created project', projectID);
    process.exit(0);
  } catch (error) {
    console.error('Notebook import failed:', error);
    process.exit(1);
  }
};

const main = async () => {
  if (process.argv.length > 2) {
    const files = process.argv.slice(2);
    files.forEach(filename => {
      if (extension(filename) === 'json') {
        loadNotebook(filename);
      }
    });
  }
};

main();
