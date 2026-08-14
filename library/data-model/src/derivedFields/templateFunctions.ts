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
 * Filename: templateFunctions.ts
 * Description:
 *   Builtin template functions and the lookup type templates use to find them.
 *   See the note below on why these live here rather than on the fields.
 */

import {AddressValueSchema} from '../addressTypes';
import {logWarn} from './logging';

export type TemplateFunction = (value: unknown) => string;

export type TemplateFunctionLookup = (args: {
  namespace: string;
  name: string;
}) => TemplateFunction | undefined;

/**
 * Template functions convert a field's stored value into the text a template
 * renders. They live here rather than on the field because template rendering
 * runs in both the app (form view) and the API (export), and the field
 * registry pulls in React. Keeping the map in data-model lets the registry
 * entry reference the same function, so both sides render identically.
 */

/** Nullable schema for field value (empty when no address entered). */
const AddressValueNullableSchema = AddressValueSchema.nullable();

/** Template expansion: parse with AddressValueNullableSchema, then return `display_name`. */
export function addressValueForTemplate(value: unknown): string {
  const parsed = AddressValueNullableSchema.safeParse(value);
  if (!parsed.success) {
    logWarn(
      'AddressField templateFunction: value did not match AddressValueNullableSchema:',
      parsed.error.format()
    );
    return '';
  }
  if (parsed.data === null) {
    return '';
  }
  return parsed.data.display_name.trim();
}

// Keyed by namespace::component-name, matching the field registry identity.
const BUILTIN_TEMPLATE_FUNCTIONS: Record<string, TemplateFunction> = {
  'faims-custom::AddressField': addressValueForTemplate,
};

export const getBuiltinTemplateFunction: TemplateFunctionLookup = ({
  namespace,
  name,
}) => BUILTIN_TEMPLATE_FUNCTIONS[`${namespace}::${name}`];
