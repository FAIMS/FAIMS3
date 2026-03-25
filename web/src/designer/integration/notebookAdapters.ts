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
 * @file Map API/template notebook JSON into the designer’s `NotebookWithHistory` shape.
 */

import type {
  NotebookMetadata,
  NotebookUISpec,
  NotebookWithHistory,
} from '../state/initial';

/** API/template payload shape: flat `ui-specification` object (not undo history). */
type EncodedNotebookLike = {
  metadata?: NotebookMetadata;
  'ui-specification'?: unknown;
};

/**
 * Maps a project or template record from the main app into the designer's
 * `NotebookWithHistory` shape (present-only undo stack).
 *
 * @param notebook - Raw record with `metadata` and `ui-specification`, or undefined.
 * @returns Designer state wrapper, or undefined if either top-level part is missing.
 */
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
