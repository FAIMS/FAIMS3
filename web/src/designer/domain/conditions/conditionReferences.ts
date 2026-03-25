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
 * @file Pure helpers for walking and rewriting visibility conditions (field + option refs).
 */

import type {FieldType} from '../../state/initial';
import type {ConditionType} from '../../types/condition';

/**
 * True if any leaf in the tree compares against `fieldName`.
 *
 * @param condition - Condition or group; null/undefined is false.
 * @param fieldName - Field id to look for.
 * @returns Whether the field is referenced.
 */
export const isFieldUsedInCondition = (
  condition: ConditionType | null | undefined,
  fieldName: string
): boolean => {
  if (!condition) return false;

  if (condition.field === fieldName) {
    return true;
  }

  // Composite: true if any child references the field.
  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return condition.conditions.some(subCondition =>
      isFieldUsedInCondition(subCondition, fieldName)
    );
  }

  return false;
};

/**
 * Rewrites leaf `field` ids from `oldFieldName` to `newFieldName` throughout the tree.
 *
 * @param condition - Subtree to transform.
 * @param oldFieldName - Previous field id.
 * @param newFieldName - New field id after rename.
 * @returns Updated tree; same structure when nothing matched `oldFieldName`.
 */
export const replaceFieldInCondition = (
  condition: ConditionType | null | undefined,
  oldFieldName: string,
  newFieldName: string
): ConditionType | null | undefined => {
  if (!condition) return condition;

  if (condition.field === oldFieldName) {
    return {...condition, field: newFieldName};
  }

  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return {
      ...condition,
      conditions: condition.conditions.map(subCondition =>
        replaceFieldInCondition(subCondition, oldFieldName, newFieldName)
      ) as ConditionType[],
    };
  }

  return condition;
};

type ViewConditionMap = Record<
  string,
  {
    label: string;
    condition?: ConditionType;
  }
>;

/**
 * Whether a condition tree references `fieldName` with `expectedValue` (scalar or array member).
 *
 * @param condition - Leaf or AND/OR group.
 * @param fieldName - Field id to match.
 * @param expectedValue - Option value to find (e.g. old select value).
 * @returns True if any matching leaf uses that value.
 */
const doesConditionContainValue = (
  condition: ConditionType,
  fieldName: string,
  expectedValue: string
): boolean => {
  // AND/OR groups: any branch may contain the value.
  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return condition.conditions.some(subCondition =>
      doesConditionContainValue(subCondition, fieldName, expectedValue)
    );
  }

  if (condition.field !== fieldName) {
    return false;
  }

  if (Array.isArray(condition.value)) {
    return condition.value.includes(expectedValue);
  }

  return condition.value === expectedValue;
};

/**
 * Lists human-readable places (field or section labels) that still use `oldValue`
 * for conditions on `fieldName` (e.g. before renaming a select option).
 *
 * @param allFields - Full field map.
 * @param allFviews - Sections with optional visibility conditions.
 * @param fieldName - Field whose option is changing.
 * @param oldValue - Option value to search for.
 * @returns Messages like "Field: …" / "Section: …".
 */
export const findOptionReferences = (
  allFields: Record<string, FieldType>,
  allFviews: ViewConditionMap,
  fieldName: string,
  oldValue: string
): string[] => {
  const references: string[] = [];

  // Field-level conditions
  for (const [fieldId, fieldDefinition] of Object.entries(allFields)) {
    if (
      fieldDefinition.condition &&
      doesConditionContainValue(fieldDefinition.condition, fieldName, oldValue)
    ) {
      references.push(
        `Field: ${fieldDefinition['component-parameters'].label ?? fieldId}`
      );
    }
  }

  // Section-level conditions
  for (const [sectionId, sectionDefinition] of Object.entries(allFviews)) {
    if (
      sectionDefinition.condition &&
      doesConditionContainValue(
        sectionDefinition.condition,
        fieldName,
        oldValue
      )
    ) {
      references.push(`Section: ${allFviews[sectionId].label}`);
    }
  }

  return references;
};

/**
 * Immutable rewrite: replace `oldValue` with `newValue` wherever `fieldName` is compared.
 *
 * @param condition - Condition subtree to copy and update.
 * @param fieldName - Target field id.
 * @param oldValue - Previous literal (or array element).
 * @param newValue - Replacement literal.
 * @returns New condition tree.
 */
export const updateConditionReferences = (
  condition: ConditionType,
  fieldName: string,
  oldValue: string,
  newValue: string
): ConditionType => {
  // Recurse into AND/OR groups.
  if (
    (condition.operator === 'and' || condition.operator === 'or') &&
    condition.conditions
  ) {
    return {
      ...condition,
      conditions: condition.conditions.map(subCondition =>
        updateConditionReferences(subCondition, fieldName, oldValue, newValue)
      ),
    };
  }

  if (condition.field !== fieldName) {
    return condition;
  }

  if (Array.isArray(condition.value)) {
    return {
      ...condition,
      value: condition.value.map(value =>
        value === oldValue ? newValue : value
      ),
    };
  }

  if (condition.value === oldValue) {
    return {
      ...condition,
      value: newValue,
    };
  }

  return condition;
};
