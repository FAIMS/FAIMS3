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

import {Ajv} from 'ajv';
import {schema} from '../notebook-schema';
import {FieldType, Notebook} from './initial';

/**
 * Migrate a notebook to the most recent notebook format
 * @param notebook - a notebook object that may be out of date or not even a notebook
 * @returns an updated version of the same notebook
 * @throws an Error if the notebook is not valid
 */
export const migrateNotebook = (notebook: Notebook) => {
  // error will be thrown by validateNotebook if invalid, let it go through
  const notebookCopy = JSON.parse(JSON.stringify(notebook)) as Notebook;

  // Remove null conditions before validating
  removeNullFieldConditions(notebookCopy);
  removeNullFviewConditions(notebookCopy);

  // we should maybe in future have validation against alternate notebook schema versions...
  validateNotebook(notebookCopy);

  // move field labels from old locations to .label
  updateFieldLabels(notebookCopy);

  // update format of annotation settings
  updateAnnotationFormat(notebookCopy);

  // change `helpertext` in `TakePhoto` to `helperText`
  updateHelperText(notebookCopy);

  // move any form descriptions from metadata into the fview
  updateFormSectionMeta(notebookCopy);

  // fix validation for photo fields which had a bad default
  fixPhotoValidation(notebookCopy);

  // fix bad autoincrementer initial value
  fixAutoIncrementerInitialValue(notebookCopy);

  // fix old hrid format
  fixOldHridPrefix(notebookCopy);

  // ensure visible_types exists in the ui-specification
  updateVisibleTypes(notebookCopy);

  return notebookCopy;
};

export class ValidationError extends Error {
  messages: string[];

  constructor(messages: string[]) {
    super();
    this.messages = messages;
  }
}

/**
 * Remove any fview-level condition properties
 * that are explicitly set to null.
 */
function removeNullFviewConditions(notebook: Notebook) {
  const fviews = notebook['ui-specification']?.fviews;
  if (!fviews) return;

  for (const viewId of Object.keys(fviews)) {
    const view = fviews[viewId] as Record<string, unknown>;
    if ('condition' in view && view.condition === null) {
      delete view.condition;
    }
  }
}

/**
 * Remove any fields that are set to null,
 * and remove null .condition properties.
 */
function removeNullFieldConditions(notebook: Notebook) {
  const fields = notebook['ui-specification']?.fields;
  if (!fields) return;

  const cleanedFields: {[key: string]: FieldType} = {};

  for (const [fieldName, field] of Object.entries(fields)) {
    if (field === null) {
      continue;
    }

    if ((field as any).condition === null) {
      delete (field as any).condition;
    }

    cleanedFields[fieldName] = field;
  }

  notebook['ui-specification'].fields = cleanedFields;
}

/**
 *
 * @param n - an object that might be a notebook
 * @returns a validated Notebook object
 * @throws ValidationError if there is one, `messages` property contains error messages for presentation
 */
export const validateNotebook = (n: unknown) => {
  const ajv = new Ajv();
  const validate = ajv.compile<Notebook>(schema);

  const valid = validate(n);
  if (!valid) {
    if (validate.errors) {
      console.log('Validation Errors:', validate.errors);
      const errorTexts = validate.errors.map(
        e => `${e.instancePath} ${e.message}`
      );
      throw new ValidationError(errorTexts);
    }
  }
  return valid;
};

/**
 * Update notebook fields so that labels are directly on component-parameters
 *
 * @param notebook A notebook that might be out of date, modified
 */
const updateFieldLabels = (notebook: Notebook) => {
  const fields: {[key: string]: FieldType} = {};

  for (const fieldName in notebook['ui-specification'].fields) {
    const field = notebook['ui-specification'].fields[fieldName];

    // clean up all the different ways that label could be stored
    const params = field['component-parameters'];
    if (params?.label) fields[fieldName] = {...field};
    else if (params?.InputLabelProps?.label) {
      params.label = params.InputLabelProps.label;
      delete params.InputLabelProps;
    } else if (params?.FormControlLabelProps?.label) {
      params.label = params.FormControlLabelProps.label;
      delete params.FormControlLabelProps;
    } else if (params?.FormLabelProps?.children) {
      params.label = params.FormLabelProps.children;
      delete params.FormLabelProps;
    } else if (params?.name) {
      params.label = params.name;
    }
    fields[fieldName] = {
      ...field,
      'component-parameters': params,
    };
  }
  notebook['ui-specification'].fields = fields;
};

type LabelInclude = {
  label: string;
  include: boolean;
};

type OldMetaType = {
  annotation_label?: string;
  annotation?: boolean | LabelInclude;
  uncertainty: {
    include: boolean;
    label: string;
  };
};

/**
 * Update a notebook to use the newer annotation field specification
 *
 * @param notebook A notebook that might be out of date, modified
 */
const updateAnnotationFormat = (notebook: Notebook) => {
  const fields: {[key: string]: FieldType} = {};

  for (const fieldName in notebook['ui-specification'].fields) {
    const field = notebook['ui-specification'].fields[fieldName];
    const meta = field.meta as OldMetaType;
    if (typeof meta?.annotation === 'boolean') {
      field.meta = {
        annotation: {
          include: meta.annotation,
          label: meta.annotation_label || 'Annotation',
        },
        uncertainty: {
          include: meta.uncertainty?.include || false,
          label: meta.uncertainty?.label || 'uncertainty',
        },
      };
    }
    fields[fieldName] = field;
  }

  notebook['ui-specification'].fields = fields;
};

/**
 * Update a notebook to use consistent helperText properties
 *
 * @param notebook A notebook that might be out of date, modified
 */
const updateHelperText = (notebook: Notebook) => {
  const fields: {[key: string]: FieldType} = {};

  for (const fieldName in notebook['ui-specification'].fields) {
    const field = notebook['ui-specification'].fields[fieldName];

    const params = field['component-parameters'];
    const originalValue = params?.helperText;
    // TakePhoto used to use this]
    if (params?.helpertext) {
      params.helperText = originalValue || params.helpertext;
      delete params.helpertext;
    } else if (params?.FormHelperTextProps) {
      params.helperText = originalValue || params.FormHelperTextProps.children;
      delete params.FormHelperTextProps;
    }

    fields[fieldName] = field;
  }

  notebook['ui-specification'].fields = fields;
};

/**
 * A couple of types to make the migration code easier below
 * since we're removing this stuff it doesn't need to be seen outside here
 */
type StringMap = {
  [key: string]: string;
};
type SectionType = {
  [key: string]: StringMap;
};

/**
 * Update a notebook to put form labels in the form section
 *
 * @param notebook A notebook that might be out of date, modified
 */
const updateFormSectionMeta = (notebook: Notebook) => {
  const sections = notebook.metadata?.sections as SectionType;
  const fviews = notebook['ui-specification'].fviews;
  const prefix = 'sectiondescription';

  if (sections) {
    for (const sectionId in sections) {
      const description = sections[sectionId][prefix + sectionId] || '';

      if (fviews[sectionId]) {
        fviews[sectionId].description = description;
      }
    }
    delete notebook.metadata.sections;
  }
};

const fixPhotoValidation = (notebook: Notebook) => {
  const goodValidation = [
    ['yup.array'],
    ['yup.of', [['yup.object'], ['yup.nullable']]],
    ['yup.nullable'],
  ];

  const fields: {[key: string]: FieldType} = {};

  for (const fieldName in notebook['ui-specification'].fields) {
    const field = notebook['ui-specification'].fields[fieldName];

    if (field['component-name'] === 'TakePhoto') {
      if (field.validationSchema?.length === 2)
        field.validationSchema = goodValidation;
    }

    fields[fieldName] = field;
  }

  notebook['ui-specification'].fields = fields;
};

/**
 * In some old notebooks, the initialValue of an auto incrementer was null
 * which conflicts with the validate schema and triggers an error
 * message on load in some cases.  Here we replace that with the empty string.
 *
 * @param notebook A notebook that might be out of date, modified
 */
const fixAutoIncrementerInitialValue = (notebook: Notebook) => {
  const fields: {[key: string]: FieldType} = {};

  for (const fieldName in notebook['ui-specification'].fields) {
    const field = notebook['ui-specification'].fields[fieldName];

    if (field['component-name'] === 'BasicAutoIncrementer') {
      if (field.initialValue === null) field.initialValue = '';
    }

    fields[fieldName] = field;
  }

  notebook['ui-specification'].fields = fields;
};

/**
 * Move any hrid prefix fields to hridField in the viewset settings.
 * @param notebook A notebook that might be out of date, modified
 */
const fixOldHridPrefix = (notebook: Notebook) => {
  const fieldToViewset: {[key: string]: string} = {};

  // Build map of fields to their containing viewsets
  for (const viewsetId of Object.keys(notebook['ui-specification'].viewsets)) {
    const viewset = notebook['ui-specification'].viewsets[viewsetId];
    for (const viewId of viewset.views) {
      const view = notebook['ui-specification'].fviews[viewId];
      for (const fieldName of view.fields) {
        fieldToViewset[fieldName] = viewsetId;
      }
    }
  }

  // Process fields, moving HRID fields to viewset settings
  for (const fieldName of Object.keys(notebook['ui-specification'].fields)) {
    // Always strip off the hrid true property - this is no longer
    const params =
      notebook['ui-specification'].fields[fieldName]['component-parameters'];
    if (params && 'hrid' in params) {
      delete params.hrid;
    }

    if (fieldName.startsWith('hrid')) {
      const viewsetName = fieldToViewset[fieldName];
      if (viewsetName) {
        notebook['ui-specification'].viewsets[viewsetName].hridField =
          fieldName;
      }
    }
  }

  return notebook;
};

/**
 * Ensure that the `visible_types` property exists in the ui-specification.
 * If not, initialise it to the keys of the viewsets (or an empty array if there are none).
 *
 * @param notebook A notebook that might be out of date, modified
 */
const updateVisibleTypes = (notebook: Notebook) => {
  if (!notebook['ui-specification'].visible_types) {
    notebook['ui-specification'].visible_types =
      Object.keys(notebook['ui-specification'].viewsets) || [];
  }
};
