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

import {useAppSelector} from '../../state/hooks';
import {allOperators} from './constants';
import {ConditionType} from './types';
import {getFieldLabel} from './utils';

export const ConditionTranslation = (props: {condition: ConditionType}) => {
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );

  const getFieldName = (field: string | undefined) => {
    if (field !== undefined && field in allFields)
      return getFieldLabel(allFields[field]);
    else return field;
  };
  /**
   * Translate a condition into English for display
   * @param condition a condition object
   */
  const translateCondition = (condition: ConditionType) => {
    if (condition === undefined) return 'empty condition';
    let result = '';
    if (condition.operator === 'and' || condition.operator === 'or') {
      if (condition.conditions) {
        const subTranslations = condition.conditions.map(cond => {
          return translateCondition(cond);
        });
        result = subTranslations.join(' ' + condition.operator + ' ');
      } else {
        result = 'empty condition';
      }
    } else {
      result =
        getFieldName(condition.field) +
        ' ' +
        allOperators.get(condition.operator)?.toLowerCase() +
        ' ' +
        (condition.value as string);
    }
    return result;
  };

  return <span>{translateCondition(props.condition)}</span>;
};
