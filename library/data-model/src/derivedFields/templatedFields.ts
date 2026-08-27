/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: templatedFields.ts
 * Description:
 *   Templated string evaluation. Lives in @faims3/data-model so the app and
 *   server-side evaluation share one implementation; the forms library binds
 *   it to the field registry and the tanstack form.
 */

import Mustache from 'mustache';
import {
  CREATED_TIME_ID,
  CREATOR_NAME_ID,
  getFieldToIdsMap,
  UiSpecModel,
  ValuesObject,
} from '../uiSpecification';
import {logWarn} from '../logging';
import {contextToTemplate, RecordContext} from './recordContext';
import {
  getBuiltinTemplateFunction,
  TemplateFunctionLookup,
} from './templateFunctions';

/*
Patch mustache to not escape values.

This addresses JIRA BSS-714 where Observation/Point of Interest was being
rendered as "Observation&#x2F;Point of Interest"

This is generally a risky approach but safe enough in our use case provided the
output is never:

- Inserted into the DOM using .innerHTML
- Used as an HTML attribute value
- Evaluated as JavaScript
- Used in a <script> tag
- Used in a CSS value
- Used in a URL
*/
Mustache.escape = function (text: string) {
  return text;
};

export const TEMPLATED_STRING_FIELD_NAME = 'TemplatedStringField';

/**
 * If the field's type has a template function, run it to produce the string
 * Mustache sees; otherwise return the raw value (existing behaviour).
 */
function valueForTemplateExpansion({
  fieldName,
  value,
  uiSpecification,
  getTemplateFunction,
}: {
  fieldName: string;
  value: unknown;
  uiSpecification: UiSpecModel;
  getTemplateFunction: TemplateFunctionLookup;
}): unknown {
  const fieldDetails = uiSpecification.fields[fieldName];
  if (!fieldDetails) {
    return value;
  }
  const namespace = fieldDetails['component-namespace'];
  const componentName = fieldDetails['component-name'];
  if (typeof namespace !== 'string' || typeof componentName !== 'string') {
    return value;
  }
  const fn = getTemplateFunction({namespace, name: componentName});
  if (!fn) {
    return value;
  }
  try {
    const out = fn(value);
    return typeof out === 'string' ? out : '';
  } catch (e) {
    logWarn(
      `templateFunction failed for field "${fieldName}" (${namespace}::${componentName}):`,
      e
    );
    return '';
  }
}

/**
 * Renders a mustache template into a string
 * @param template The template string
 * @param values The form values to use in replacement
 * @param context The record context
 * @param excludedFields Fields to exclude from replacement
 * @param getTemplateFunction Field-type template function lookup; defaults to
 *   the builtin map, which is what the API uses.
 */
export function renderTemplate({
  template,
  values,
  context,
  excludedFields,
  uiSpecification,
  getTemplateFunction = getBuiltinTemplateFunction,
}: {
  template: string;
  values: ValuesObject;
  context: RecordContext;
  excludedFields: string[];
  uiSpecification: UiSpecModel;
  getTemplateFunction?: TemplateFunctionLookup;
}): string {
  // generate context vars from record context
  const contextVars = contextToTemplate(context);
  const filteredValues: ValuesObject = {};
  for (const [k, v] of Object.entries({...values, ...contextVars})) {
    if (!excludedFields.includes(k)) {
      const isInjectedContextKey =
        k === CREATOR_NAME_ID || k === CREATED_TIME_ID;
      filteredValues[k] = isInjectedContextKey
        ? v
        : valueForTemplateExpansion({
            fieldName: k,
            value: v,
            uiSpecification,
            getTemplateFunction,
          });
    }
  }
  // Parent record values available as {{_PARENT.Field-ID}}
  if (context.parentValues) {
    const parent: ValuesObject = {};
    for (const [k, v] of Object.entries(context.parentValues)) {
      parent[k] = valueForTemplateExpansion({
        fieldName: k,
        value: v,
        uiSpecification,
        getTemplateFunction,
      });
    }
    filteredValues['_PARENT'] = parent;
  }

  return Mustache.render(template, filteredValues);
}

/**
 * Given the existing values, ui spec and context, recomputes templated string
 * values for the given form. Templated strings are excluded as inputs to each
 * other.
 *
 * @returns Whether anything changed, and the new values keyed by field name
 */
export function recomputeDerivedFields({
  values,
  uiSpecification,
  formId,
  context,
  getTemplateFunction = getBuiltinTemplateFunction,
}: {
  values: ValuesObject;
  uiSpecification: UiSpecModel;
  formId: string;
  context: RecordContext;
  getTemplateFunction?: TemplateFunctionLookup;
}): {changes: boolean; updates: Record<string, string>} {
  // compute fields to be updated
  const fieldsToBeUpdated: {template: string; fieldName: string}[] = [];
  const filterFields: string[] = [];
  const fieldMap = getFieldToIdsMap(uiSpecification);

  for (const [fieldName, location] of Object.entries(fieldMap)) {
    if (location.viewSetId !== formId) {
      continue;
    }

    const fieldDetails = uiSpecification.fields[fieldName];
    if (fieldDetails['component-name'] === TEMPLATED_STRING_FIELD_NAME) {
      // Always filter templated strings out of template expansion
      filterFields.push(fieldName);

      const template = fieldDetails['component-parameters']?.template;
      if (!template) {
        logWarn('TemplatedStringField missing template prop - cannot render.');
        continue;
      }
      if (typeof template !== 'string') {
        logWarn('TemplatedStringField template prop is not a string.');
        continue;
      }
      fieldsToBeUpdated.push({fieldName, template});
    }
  }

  let changeDetected = false;
  const updates: Record<string, string> = {};

  for (const {fieldName, template} of fieldsToBeUpdated) {
    const rendered = renderTemplate({
      context,
      template,
      values,
      excludedFields: filterFields,
      uiSpecification,
      getTemplateFunction,
    });
    const previousFieldValue = values[fieldName];
    if (previousFieldValue !== rendered) {
      updates[fieldName] = rendered;
      changeDetected = true;
    }
  }

  return {changes: changeDetected, updates};
}
