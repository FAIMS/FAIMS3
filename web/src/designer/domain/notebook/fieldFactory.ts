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
 * @file Clone helpers for field specs and designer UUID assignment.
 */

import {v4 as uuidv4} from 'uuid';
import type {FieldType} from '../../state/initial';

/**
 * Deep-clone a field spec (JSON round-trip).
 *
 * @param field - Source field from the UI spec.
 * @returns Independent copy safe to mutate.
 */
export const cloneField = (field: FieldType): FieldType =>
  JSON.parse(JSON.stringify(field)) as FieldType;

/**
 * Clone and assign a fresh `designerIdentifier` (e.g. after duplicate).
 *
 * @param field - Field to copy.
 * @returns Clone with new UUID.
 */
export const cloneFieldWithDesignerIdentifier = (
  field: FieldType
): FieldType => {
  const cloned = cloneField(field);
  cloned.designerIdentifier = uuidv4();
  return cloned;
};
