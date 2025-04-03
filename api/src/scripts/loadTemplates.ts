/* eslint-disable n/no-process-exit */
import {readFileSync} from 'fs';
import {createTemplate} from '../couchdb/templates';
import {TemplateEditableDetails} from '@faims3/data-model';

const extension = (filename: string) => {
  return (
    filename.substring(filename.lastIndexOf('.') + 1, filename.length) ||
    filename
  );
};

const loadTemplate = async (filename: string) => {
  try {
    console.log('loading', filename);
    const jsonText = readFileSync(filename, 'utf-8');
    const templateSpec: TemplateEditableDetails = JSON.parse(jsonText);

    const result = await createTemplate({payload : templateSpec});
    console.log('created template', result._id);
    process.exit(0);
  } catch (error) {
    console.error('Template import failed:', error);
  }
};

const main = async () => {
  if (process.argv.length > 2) {
    const files = process.argv.slice(2);
    files.forEach(filename => {
      if (extension(filename) === 'json') {
        loadTemplate(filename);
      }
    });
  }
};

main();
