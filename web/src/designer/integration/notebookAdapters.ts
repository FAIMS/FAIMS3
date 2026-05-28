// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Map API/template records into the designer's `NotebookWithHistory` shape.
 */

import type {NotebookDefinition} from '@faims3/data-model';
import type {
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from '../state/initial';
import {
  normalizeApiUiSpecification,
  type NormalizeApiUiSpecificationResult,
  tryNormalizeApiUiSpecification,
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
  record?: ApiRecordWithUiSpecification
): NotebookWithHistory | undefined => {
  if (!record?.uiSpecification) {
    return undefined;
  }

  const definition = normalizeApiUiSpecification(record.uiSpecification);
  return notebookDefinitionToDesignerHistory(definition);
};

/** Wrap a normalized definition for Redux (empty undo stacks). */
export const notebookDefinitionToDesignerHistory = (
  definition: NotebookDefinition
): NotebookWithHistory => ({
  metadata: definition.metadata,
  uiSpec: {
    present: definition.uiSpec as NotebookUISpec,
    past: [],
    future: [],
  },
});

/** Flat definition for API PUT / export (present UI spec only). */
export const designerHistoryToNotebookDefinition = (
  notebook: NotebookWithHistory
): Notebook => ({
  metadata: notebook.metadata,
  uiSpec: notebook.uiSpec.present,
});
