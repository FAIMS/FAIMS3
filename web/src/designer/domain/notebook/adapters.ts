import {v4 as uuidv4} from 'uuid';
import type {Notebook, NotebookWithHistory} from '../../state/initial';

const cloneNotebook = (notebook: Notebook): Notebook =>
  JSON.parse(JSON.stringify(notebook)) as Notebook;

export const toNotebookWithHistory = (
  notebook: Notebook
): NotebookWithHistory => ({
  metadata: notebook.metadata,
  'ui-specification': {
    present: notebook['ui-specification'],
    past: [],
    future: [],
  },
});

export const toNotebook = (notebook: NotebookWithHistory): Notebook => ({
  metadata: notebook.metadata,
  'ui-specification': notebook['ui-specification'].present,
});

export const attachMissingDesignerIdentifiers = (
  notebook: Notebook
): Notebook => {
  const cloned = cloneNotebook(notebook);
  Object.values(cloned['ui-specification'].fields).forEach(field => {
    if (!field.designerIdentifier) {
      field.designerIdentifier = uuidv4();
    }
  });
  return cloned;
};

export const stripDesignerIdentifiers = (notebook: Notebook): Notebook => {
  const cloned = cloneNotebook(notebook);
  Object.values(cloned['ui-specification'].fields).forEach(field => {
    delete field.designerIdentifier;
  });
  return cloned;
};
