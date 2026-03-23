import type {
  NotebookMetadata,
  NotebookUISpec,
  NotebookWithHistory,
} from '../state/initial';

type EncodedNotebookLike = {
  metadata?: NotebookMetadata;
  'ui-specification'?: unknown;
};

export const toDesignerNotebookWithHistory = (
  notebook?: EncodedNotebookLike
): NotebookWithHistory | undefined => {
  if (!notebook?.metadata || !notebook['ui-specification']) {
    return undefined;
  }

  return {
    metadata: notebook.metadata,
    'ui-specification': {
      present: notebook['ui-specification'] as NotebookUISpec,
      past: [],
      future: [],
    },
  };
};
