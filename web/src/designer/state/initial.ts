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

/** Merged props for FAIMS form components (`component-parameters` in notebook JSON). */
export type ComponentParameters = {
  fullWidth?: boolean;
  name?: string;
  id?: string;
  helperText?: string;
  helpertext?: string; // was allowed for TakePhoto
  advancedHelperText?: string;
  variant?: string;
  label?: string;
  multiline?: boolean;
  multiple?: boolean;
  SelectProps?: unknown;
  ElementProps?: {
    expandedChecklist?: boolean;
    // These items must correspond to values in the options[]. Only one of such
    // can be selecting, greying out/excluding other options
    exclusiveOptions?: string[];
    enableOtherOption?: boolean;
    otherOptionPosition?: number;
    options?: {
      value: string;
      label: string;
      RadioProps?: unknown;
    }[];
    optiontree?: unknown;
  };
  InputLabelProps?: {label: string};
  InputProps?: {rows?: number; type?: string};
  FormLabelProps?: {children?: string};
  FormHelperTextProps?: {children?: string};
  FormControlLabelProps?: {label: string};
  // default false
  allowSetToCurrentPoint?: boolean;
  initialValue?: unknown;
  related_type?: string;
  hideCreateAnotherButton?: boolean;
  relation_type?: string;
  related_type_label?: string;
  relation_linked_vocabPair?: [string, string][];
  numberType?: 'integer' | 'floating';
  required?: boolean;
  template?: string;
  num_digits?: number;
  form_id?: string;
  isAutoPick?: boolean;
  is_auto_pick?: boolean;
  show_now_button?: boolean;
  zoom?: number;
  featureType?: string;
  buttonLabelText?: string;
  variant_style?: string;
  html_tag?: string;
  content?: string;
  hrid?: boolean;
  select?: boolean;
  geoTiff?: string;
  type?: string;
  min?: number;
  max?: number;
  rows?: number;
  valuetype?: string;
  protection?: 'protected' | 'allow-hiding' | 'none';
  hidden?: boolean;
  allowLinkToExisting?: boolean;
  /** Enable speech-to-text input (default: true) */
  enableSpeech?: boolean;
  /** Whether to append speech to existing text or replace */
  speechAppendMode?: boolean;
  /** Enable online address auto-suggestion providers */
  enableAutoSuggestion?: boolean;
  /** Allow manual structured address entry as fallback */
  allowFullAddressManualEntry?: boolean;
};

/** Single field definition: component binding, parameters, optional visibility condition. */
export type FieldType = {
  'component-namespace': string;
  'component-name': string;
  'type-returned': string;
  'component-parameters': ComponentParameters;
  initialValue?: unknown;
  access?: string[];
  condition?: ConditionType | null;
  persistent?: boolean;
  displayParent?: boolean;
  designerIdentifier?: string;
  humanReadableName?: string;
  category?: string;

  humanReadableDescription?: string;
  showInChooser?: boolean;
  order?: number;
  deprecated?: boolean;
  deprecationMessage?: string;

  meta?: {
    annotation: {
      include: boolean;
      label: string;
    };
    uncertainty: {
      include: boolean;
      label: string;
    };
  };
};

/** Editable UI spec body: fields, sections (`views`), forms (`viewsets`), settings, schema version. */
export type NotebookUISpec = {
  fields: {[key: string]: FieldType};
  views: {
    [key: string]: {
      fields: string[];
      description?: string;
      uidesign?: string;
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
