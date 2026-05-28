/* eslint-disable n/no-process-exit */
import {createNotebook} from '../couchdb/notebooks';
import {readFileSync} from 'fs';

const extension = (filename: string) => {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
};

const loadProject = async (filename: string) => {
  try {
    const jsonText = readFileSync(filename, 'utf-8');
    const body = JSON.parse(jsonText) as {
      name: string;
      description?: string;
      uiSpecification: Parameters<typeof createNotebook>[0]['uiSpecification'];
    };

    const projectID = await createNotebook({
      projectName: body.name,
      uiSpecification: body.uiSpecification,
      description: body.description ?? '',
      createdBy: 'admin',
    });
    console.log('created project', projectID);
    process.exit(0);
  } catch (error) {
    console.error('Project import failed:', error);
  }
};

const main = async () => {
  if (process.argv.length > 2) {
    const files = process.argv.slice(2);
    files.forEach(filename => {
      if (extension(filename) === 'json') {
        loadProject(filename);
      }
    });
  }
};

main();
