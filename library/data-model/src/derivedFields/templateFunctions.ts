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
 *   Field-type template functions: turn a field's stored value into the
 *   string Mustache sees during template expansion. Defined here rather than
 *   only in the forms field registry so server-side evaluation (#2245)
 *   produces byte-identical output to the form. A field type adding a
 *   templateFunction must define it in this map and reference it from its
 *   registry entry.
 */

import {AddressValueSchema} from '../addressTypes';
import {logWarn} from './logging';

export type TemplateFunction = (value: unknown) => string;

export type TemplateFunctionLookup = (args: {
  namespace: string;
  name: string;
}) => TemplateFunction | undefined;

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
