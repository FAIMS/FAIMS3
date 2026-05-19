import fs from 'fs';
import path from 'path';
import type {
  CreateNotebookFromScratch,
  NotebookDefinition,
  PostCreateTemplateInput,
} from '@faims3/data-model';
import {createNotebook} from '../src/couchdb/notebooks';

/** On-disk shape of {@link ../notebooks/sample_notebook.json}. */
export type SampleNotebookFile = {
  name: string;
  description: string;
  uiSpecification: NotebookDefinition;
};

const NOTEBOOKS_DIR = path.join(__dirname, '../notebooks');

export function readSampleNotebookFile(): SampleNotebookFile {
  return JSON.parse(
    fs.readFileSync(path.join(NOTEBOOKS_DIR, 'sample_notebook.json'), 'utf-8')
  ) as SampleNotebookFile;
}

/** Legacy wire-format export kept for migration tests (`metadata` + `ui-specification`). */
export function readLegacyNotebookFile(): {
  metadata: Record<string, unknown>;
  'ui-specification': Record<string, unknown>;
} {
  return JSON.parse(
    fs.readFileSync(path.join(NOTEBOOKS_DIR, 'sample_notebook.legacy.json'), 'utf-8')
  );
}

export function sampleCreateNotebookPayload(
  name: string
): CreateNotebookFromScratch {
  const sample = readSampleNotebookFile();
  return {
    name,
    description: sample.description,
    uiSpecification: sample.uiSpecification,
  };
}

export function sampleCreateTemplatePayload(
  name: string
): Pick<PostCreateTemplateInput, 'name' | 'description' | 'uiSpecification'> {
  const sample = readSampleNotebookFile();
  return {
    name,
    description: sample.description,
    uiSpecification: sample.uiSpecification,
  };
}

export const EMPTY_UI_SPECIFICATION: NotebookDefinition = (
  JSON.parse(
    fs.readFileSync(
      path.join(NOTEBOOKS_DIR, 'empty_ui_specification.json'),
      'utf-8'
    )
  ) as SampleNotebookFile
).uiSpecification;

export async function createNotebookFromSampleFile(
  projectName: string,
  createdBy = 'admin'
): Promise<string | undefined> {
  const sample = readSampleNotebookFile();
  return createNotebook({
    projectName,
    uiSpecification: sample.uiSpecification,
    description: sample.description,
    createdBy,
  });
}
