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

import {FieldType} from '../../state/initial';
import {ConditionType, SelectableConditionOption} from '../../types/condition';
import {isFieldUsedInCondition} from '../../domain/conditions/conditionReferences';

/**
 * @file Designer-facing helpers for condition references, delete safety, and option renames.
 */

/**
 * Display label for a field (`InputLabelProps.label` overrides `component-parameters.label`).
 *
 * @param f - Field definition from the UI spec.
 * @returns Human-readable label string.
 */
export const getFieldLabel = (f: FieldType) => {
  return (
    (f['component-parameters'].InputLabelProps &&
      f['component-parameters'].InputLabelProps.label) ||
    f['component-parameters'].label
  );
};

type FieldMap = Record<string, FieldType>;
type ViewMap = Record<
  string,
  {label: string; condition?: ConditionType; fields: string[]}
>;

/**
 * Lists sections/fields/templated strings that reference `fieldName` (conditions or `{{fieldName}}`).
 */
export const findFieldConditionUsage = (
  fieldName: string,
  allFields: FieldMap,
  allFviews: ViewMap
): string[] => {
  const affected: string[] = [];

  // Check section-level conditions
  for (const sectionId in allFviews) {
    const condition = allFviews[sectionId].condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      affected.push(`Section: ${allFviews[sectionId].label}`);
    }
  }

  // Check field-level conditions
  for (const fId in allFields) {
    const condition = allFields[fId].condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      const label = allFields[fId]['component-parameters']?.label ?? fId;
      affected.push(`Field Condition: ${label}`);
    }
  }

  // Check for Templated String Fields using the deleted field
  for (const fId in allFields) {
    if (allFields[fId]['component-name'] === 'TemplatedStringField') {
      const template = allFields[fId]['component-parameters']?.template || '';

      if (template.includes(`{{${fieldName}}}`)) {
        const label = allFields[fId]['component-parameters']?.label ?? fId;
        affected.push(`Templated String: ${label} (uses '{{${fieldName}}}')`);
      }
    }
  }

  return affected;
};

/**
 * findSectionExternalUsage:
 * Checks if any other section references the fields belonging to `targetSectionId`.
 * If so, returns references for display (like "Section: X references your fields").
 *
 * @param targetSectionId The ID of the section you plan to delete.
 * @param allFviews All sections
 * @param allFields All fields
 * @returns Array of strings describing external references
 */
export function findSectionExternalUsage(
  targetSectionId: string,
  allFviews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  // 1. gather all fields that belong to the target section
  const targetFields = allFviews[targetSectionId]?.fields || [];

  // 2. For each section in fviews
  for (const [sectionId, sectionDef] of Object.entries(allFviews)) {
    // If it's the same section, skip. Self-contained references are okay if you're deleting the whole section
    if (sectionId === targetSectionId) continue;

    // 2a. check section-level condition
    const sectionCond = sectionDef.condition;
    if (
      sectionCond &&
      targetFields.some(f => isFieldUsedInCondition(sectionCond, f))
    ) {
      references.push(`Section: ${sectionDef.label}`);
    }

    // 2b. check each field in that section
    for (const fieldName of sectionDef.fields) {
      const fieldCond = allFields[fieldName]?.condition;
      if (
        fieldCond &&
        targetFields.some(f => isFieldUsedInCondition(fieldCond, f))
      ) {
        const label =
          allFields[fieldName]?.['component-parameters']?.label || fieldName;
        references.push(`Field: ${label} (section: ${sectionDef.label})`);
      }
    }
  }

  return references;
}

/**
 * findFormExternalUsage:
 * Similar logic to findSectionExternalUsage, treats the entire form (across all its sections) as the target,
 * Then we see if other forms' conditions reference any of this form's fields.
 *
 * @param targetFormId The ID of the form you plan to delete
 * @param viewsets All forms
 * @param allFviews All sections
 * @param allFields All fields
 * @returns Array of strings describing references from outside forms
 */
export function findFormExternalUsage(
  targetFormId: string,
  viewsets: Record<string, {label: string; views: string[]}>,
  allFviews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  const targetFormDef = viewsets[targetFormId];
  if (!targetFormDef) return references;

  // 1. gather all fields across all sections in the target form
  const targetFields: string[] = [];
  for (const sectionId of targetFormDef.views) {
    targetFields.push(...(allFviews[sectionId]?.fields || []));
  }

  // 2. For each form in viewsets
  for (const [formId, formDef] of Object.entries(viewsets)) {
    if (formId === targetFormId) continue; // skip same form

    // 2a. for each section in that form
    for (const secId of formDef.views) {
      const secDef = allFviews[secId];
      if (!secDef) continue;
      // check section-level condition
      if (
        secDef.condition &&
        targetFields.some(f => isFieldUsedInCondition(secDef.condition, f))
      ) {
        references.push(`Section: ${secDef.label} (Form: ${formDef.label})`);
      }

      // check each field
      for (const fieldName of secDef.fields) {
        const fieldCond = allFields[fieldName]?.condition;
        if (
          fieldCond &&
          targetFields.some(f => isFieldUsedInCondition(fieldCond, f))
        ) {
          const label =
            allFields[fieldName]?.['component-parameters']?.label || fieldName;
          references.push(
            `Field: ${label} (Form: ${formDef.label}, Section: ${secDef.label})`
          );
        }
      }
    }
  }

  return references;
}

/**
 * Finds fields and sections that have visibility conditions relying on this field
 * and that expect a specific value that no longer exists.
 *
 * @param targetFieldName The name of the field being checked
 * @param targetField The field's definition
 * @param allFields All fields in the form
 * @param allFviews All sections in the form
 * @returns An array of messages identifying conditions with missing expected values
 */
export function findInvalidConditionReferences(
  targetFieldName: string,
  targetField: FieldType,
  allFields: Record<string, FieldType>,
  allFviews: Record<string, {label: string; condition?: ConditionType}>
): string[] {
  const invalidConditions: string[] = [];

  // Only need to check fields with predefined choices
  if (
    !['Select', 'RadioGroup', 'MultiSelect'].includes(
      targetField['component-name']
    )
  ) {
    return invalidConditions;
  }

  const validOptions: string[] = (
    (targetField['component-parameters'].ElementProps?.options ??
      []) as SelectableConditionOption[]
  ).map(opt => opt.value);

  // Check if a condition is using a value that no longer exists
  const getInvalidExpectedValue = (condition: ConditionType): string[] => {
    if (condition.operator === 'and' || condition.operator === 'or') {
      return condition.conditions
        ? condition.conditions.flatMap(getInvalidExpectedValue)
        : [];
    }

    if (condition.field !== targetFieldName) {
      return [];
    }

    if (Array.isArray(condition.value)) {
      const missingValues = condition.value.filter(
        val => !validOptions.includes(val)
      );
      return missingValues.length > 0
        ? [`expects '${missingValues.join(', ')}'`]
        : [];
    }

    return validOptions.includes(String(condition.value))
      ? []
      : [`expects '${String(condition.value)}'`];
  };

  // Check field conditions
  for (const [fId, fieldDef] of Object.entries(allFields)) {
    const cond = fieldDef.condition;
    if (cond && isFieldUsedInCondition(cond, targetFieldName)) {
      const invalidVals = getInvalidExpectedValue(cond);
      if (invalidVals.length > 0) {
        const label = fieldDef['component-parameters']?.label ?? fId;
        invalidVals.forEach(invalidVal => {
          invalidConditions.push(`Field: ${label} (${invalidVal})`);
        });
      }
    }
  }

  // Check section conditions
  for (const [, fviewDef] of Object.entries(allFviews)) {
    const cond = fviewDef.condition;
    if (cond && isFieldUsedInCondition(cond, targetFieldName)) {
      const invalidVals = getInvalidExpectedValue(cond);
      if (invalidVals.length > 0) {
        invalidVals.forEach(invalidVal => {
          invalidConditions.push(`Section: ${fviewDef.label} (${invalidVal})`);
        });
      }
    }
  }

  return invalidConditions;
}
