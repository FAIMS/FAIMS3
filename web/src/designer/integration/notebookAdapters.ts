// SPDX-License-Identifier: Apache-2.0

/**
 * @file Map API/template records into the designer's `NotebookWithHistory` shape.
 */

import {UI_SPECIFICATION_HASH_HEX_LENGTH} from '@faims3/data-model';
import type {
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from '../state/initial';
import {
  type NormalizeApiUiSpecificationResult,
  tryNormalizeApiUiSpecification,
  DesignerDocumentMode,
} from './legacyNotebook';

export type {NormalizeApiUiSpecificationResult};
export {tryNormalizeApiUiSpecification};

/** Project or template GET payload carrying an inlined design bundle. */
export type ApiRecordWithUiSpecification = {
  uiSpecification?: unknown;
  uiSpecProperties?: {hash?: unknown};
};

/** Live survey/template snapshot used to pin a designer overlay session. */
export type DesignerLiveDesignSnapshot = {
  notebook?: NotebookWithHistory;
  liveUiSpecHash?: string;
};

/**
 * Accept a `uiSpecProperties.hash` only when it is a SHA-256 hex digest.
 */
export const parseUiSpecHash = (hash: unknown): string | undefined =>
  typeof hash === 'string' && hash.length === UI_SPECIFICATION_HASH_HEX_LENGTH
    ? hash
    : undefined;

/** Read `uiSpecProperties.hash` from a publish result or GET payload. */
export const uiSpecHashFromRecord = (
  record?: ApiRecordWithUiSpecification | {uiSpecProperties?: {hash?: unknown}}
): string | undefined => parseUiSpecHash(record?.uiSpecProperties?.hash);

/**
 * Maps a project or template record from the main app into the designer's
 * `NotebookWithHistory` shape (present-only undo stack). Returns `undefined`
 * when the design cannot be parsed — never throws, so the Actions page stays up.
 */
export const toDesignerNotebookWithHistory = (
  record?: ApiRecordWithUiSpecification,
  mode: DesignerDocumentMode = 'project'
): NotebookWithHistory | undefined => {
  if (!record?.uiSpecification) {
    return undefined;
  }

  const result = tryNormalizeApiUiSpecification(record.uiSpecification, mode);
  if (!result.ok) {
    return undefined;
  }
  return notebookDefinitionToDesignerHistory(result.data);
};

/**
 * Map a project or template GET payload to the designer overlay snapshot
 * (normalized notebook plus `uiSpecProperties.hash`).
 */
export const designerLiveSnapshotFromRecord = (
  record?: ApiRecordWithUiSpecification,
  mode: DesignerDocumentMode = 'project'
): DesignerLiveDesignSnapshot => {
  return {
    notebook: toDesignerNotebookWithHistory(record, mode),
    liveUiSpecHash: uiSpecHashFromRecord(record),
  };
};

/**
 * Hydrate a stored or exported notebook through the same load path as a server
 * record (`tryNormalizeApiUiSpecification` / `migrateNotebook`).
 */
export const hydrateExportedNotebook = (
  exported: unknown,
  mode: DesignerDocumentMode = 'project'
): NotebookWithHistory | undefined =>
  toDesignerNotebookWithHistory({uiSpecification: exported}, mode);

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
