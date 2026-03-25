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
 * @file Small helpers to clone fields and apply updates before `fieldUpdated` dispatches.
 */

import {cloneField} from '@/designer/domain/notebook/fieldFactory';
import type {FieldType} from '../../../state/initial';

/**
 * Clone-then-mutate pattern for dispatching `fieldUpdated` with minimal boilerplate.
 *
 * @param field - Current field snapshot.
 * @param updater - Synchronous mutator on the clone.
 * @returns New field object to put in the action payload.
 */
export const withUpdatedField = (
  field: FieldType,
  updater: (nextField: FieldType) => void
): FieldType => {
  const nextField = cloneField(field);
  updater(nextField);
  return nextField;
};
