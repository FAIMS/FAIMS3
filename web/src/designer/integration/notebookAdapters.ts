// SPDX-License-Identifier: Apache-2.0

/**
 * @file Map API/template records into the designer's `NotebookWithHistory` shape.
 */

import type {
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from '../state/initial';
import {
  normalizeApiUiSpecification,
  type NormalizeApiUiSpecificationResult,
  tryNormalizeApiUiSpecification,
  DesignerDocumentMode,
} from './legacyNotebook';

export type {NormalizeApiUiSpecificationResult};
export {tryNormalizeApiUiSpecification};

/** Project or template GET payload carrying an inlined design bundle. */
type ApiRecordWithUiSpecification = {
  uiSpecification?: unknown;
};

/**
 * Maps a project or template record from the main app into the designer's
 * `NotebookWithHistory` shape (present-only undo stack).
 */
export const toDesignerNotebookWithHistory = (
  record?: ApiRecordWithUiSpecification,
  mode: DesignerDocumentMode = 'project'
): NotebookWithHistory | undefined => {
  if (!record?.uiSpecification) {
    return undefined;
  }

  const definition = normalizeApiUiSpecification(record.uiSpecification, mode);
  return notebookDefinitionToDesignerHistory(definition);
};

/** Wrap a normalized definition for Redux (empty undo stacks). */
export const notebookDefinitionToDesignerHistory = (
  definition: Notebook
): NotebookWithHistory => ({
  metadata: definition.metadata,
  uiSpec: {
    present: definition.uiSpec as NotebookUISpec,
    past: [],
    future: [],
  },
  planTemplates: definition.planTemplates ?? [],
  plans: definition.plans ?? [],
});

/** Flat definition for API PUT / export (present UI spec only). */
export const designerHistoryToNotebookDefinition = (
  notebook: NotebookWithHistory
): Notebook => ({
  metadata: notebook.metadata,
  uiSpec: notebook.uiSpec.present,
  // empty becomes an absent key so saved JSON stays clean
  ...(notebook.planTemplates.length
    ? {planTemplates: notebook.planTemplates}
    : {}),
  // Carried through untouched: the designer does not author instantiated
  // plans, and dropping them here would strip them from the saved notebook
  ...(notebook.plans.length ? {plans: notebook.plans} : {}),
});
