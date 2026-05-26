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
 * @file Empty condition templates and operator label map for the builder UI.
 */

import {ConditionType} from '../../types/condition';

/** Default leaf: equal operator, empty field/value (starting point in the builder). */
export const EMPTY_FIELD_CONDITION: ConditionType = {
  operator: 'equal',
  field: '',
  value: '',
};

/** Default group: AND with no children yet. */
export const EMPTY_BOOLEAN_CONDITION: ConditionType = {
  operator: 'and',
  conditions: [],
};

/** UI labels for condition operators (keys match persisted `operator` strings). */
export const allOperators = new Map([
  ['equal', 'Equal to'],
  ['not-equal', 'Not equal to'],
  ['greater', 'Greater than'],
  ['greater-equal', 'Greater than or equal'],
  ['less', 'Less than'],
  ['less-equal', 'Less than or equal'],
  ['regex', 'Matches regular expression'],
  ['string-contains', 'String contains'],
  ['string-does-not-contain', 'String does not contain'],
  ['contains', 'List contains this value'],
  ['does-not-contain', 'List does not contain'],
  ['contains-regex', 'List contains a value matching the regular expression'],
  [
    'does-not-contain-regex',
    'List does not contain any value matching the regular expression',
  ],
  ['contains-one-of', 'List contains one of these values'],
  ['does-not-contain-any-of', 'List does not contain any of these values'],
  ['contains-all-of', 'List contains all of these values'],
  ['does-not-contain-all-of', 'List does not contain all of these values'],
]);
