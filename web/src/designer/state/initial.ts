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
 * @file Core Redux state types for the notebook designer: typed metadata partition,
 * UI specification (fields/views/viewsets), and the undo-wrapped notebook shape.
 */

// eslint-disable-next-line n/no-extraneous-import
import {StateWithHistory} from 'redux-undo';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  type BaseFieldParameters,
  type FieldDefinition,
  type NotebookDefinition,
  type NotebookInformation,
  type NotebookMetadata,
  type NotebookSettings,
} from '@faims3/data-model';
import {ConditionType} from '../types/condition';

export {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION};
export type {
  NotebookDefinition,
  NotebookInformation,
  NotebookMetadata,
  NotebookSettings,
};

/**
 * The component-parameters envelope shared by every designer field.
 *
 * It guarantees the {@link BaseFieldParameters} common to all fields and leaves
 * the remaining per-field-type parameters open (`unknown`). Each editor narrows
 * this envelope to the precise props type its field exports from
 * `@faims3/forms` (e.g. `NumberFieldProps`, `ChoiceElementProps`) rather than
 * the designer maintaining a duplicate flattened union of every field's params.
 */
export type ComponentParametersEnvelope = BaseFieldParameters & {
  [key: string]: unknown;
};

/**
 * Single field definition as used in the designer.
 *
 * The canonical runtime shape lives in `@faims3/data-model`
 * ({@link FieldDefinition}); here we only add the designer-specific authoring
 * and field-chooser metadata, and narrow two properties:
 * - `component-parameters` to the {@link ComponentParametersEnvelope} (base
 *   params + open extras), and
 * - `condition` to the designer's {@link ConditionType} (allowing `null`).
 */
export type FieldType = Omit<
  FieldDefinition,
  'component-parameters' | 'condition'
> & {
  'component-parameters': ComponentParametersEnvelope;
  condition?: ConditionType | null;

  // Designer-only authoring / field-chooser metadata (not part of the runtime
  // field definition).
  designerIdentifier?: string;
  humanReadableName?: string;
  humanReadableDescription?: string;
  category?: string;
  showInChooser?: boolean;
  order?: number;
  deprecated?: boolean;
  deprecationMessage?: string;
};

/** Editable UI spec body: fields, sections (`views`), forms (`viewsets`), settings, schema version. */
export type NotebookUISpec = {
  fields: {[key: string]: FieldType};
  views: {
    [key: string]: {
      fields: string[];
      description?: string;
      label: string;
      condition?: ConditionType;
    };
  };
  viewsets: {
    [key: string]: {
      views: string[];
      label: string;
      summary_fields?: string[];
      layout?: 'inline' | 'tabs';
      hridField?: string;
    };
  };
  visible_types: string[];
  settings: NotebookSettings;
  schemaVersion: string;
};

/** Root designer store: notebook slice + dirty flag for save prompts. */
export type AppState = {
  modified: boolean;
  notebook: NotebookWithHistory;
};

/** Flat notebook definition as persisted via PUT /uiSpecification. */
export type Notebook = NotebookDefinition;

/** Notebook with `uiSpec` wrapped for undo/redo in the designer. */
export type NotebookWithHistory = {
  metadata: NotebookMetadata;
  uiSpec: StateWithHistory<NotebookUISpec>;
};

export const defaultNotebookInformation = (): NotebookInformation => ({
  notebookVersion: '1.0',
  purposeMarkdown: '',
  projectLeadLabel: '',
  leadInstitution: '',
});

export const defaultNotebookMetadata = (): NotebookMetadata => ({
  information: defaultNotebookInformation(),
});

export const defaultNotebookUISpec = (): NotebookUISpec => ({
  fields: {},
  views: {},
  viewsets: {},
  visible_types: [],
  settings: {showQrCodeButton: false},
  schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
});

/** Default empty designer state. */
export const initialState: AppState = {
  modified: false,
  notebook: {
    metadata: defaultNotebookMetadata(),
    uiSpec: {
      present: defaultNotebookUISpec(),
      past: [],
      future: [],
    },
  },
};
