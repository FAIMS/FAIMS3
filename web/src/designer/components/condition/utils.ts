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

import {ChoiceElementProps, TemplatedStringProps} from '@faims3/forms';
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
  const params = f['component-parameters'] as TemplatedStringProps;
  return (
    (params.InputLabelProps && params.InputLabelProps.label) || params.label
  );
};

type FieldMap = Record<string, FieldType>;
type ViewMap = Record<
  string,
  {label: string; condition?: ConditionType; fields: string[]}
>;
type ViewSetMap = Record<string, {label: string; views: string[]}>;

export type FieldDependencyReference = {
  type: 'section-condition' | 'field-condition' | 'templated-string';
  formId?: string;
  formLabel?: string;
  sectionId?: string;
  sectionLabel?: string;
  fieldId?: string;
  fieldLabel?: string;
  templateUsage?: string;
};

const buildFieldLocationMaps = (allViews: ViewMap, viewsets: ViewSetMap) => {
  const sectionToForm = new Map<string, {formId: string; formLabel: string}>();
  const fieldToSection = new Map<
    string,
    {sectionId: string; sectionLabel: string}
  >();

  for (const [formId, viewset] of Object.entries(viewsets)) {
    for (const sectionId of viewset.views) {
      sectionToForm.set(sectionId, {formId, formLabel: viewset.label});
    }
  }

  for (const [sectionId, sectionDef] of Object.entries(allViews)) {
    for (const fieldId of sectionDef.fields) {
      fieldToSection.set(fieldId, {
        sectionId,
        sectionLabel: sectionDef.label,
      });
    }
  }

  return {sectionToForm, fieldToSection};
};

/**
 * Lists sections/fields/templated strings that reference `fieldName` (conditions or `{{fieldName}}`).
 * Scoped to the same form as `fieldName` — conditions cannot reference fields from other forms.
 */
export const findFieldDependencyReferences = (
  fieldName: string,
  allFields: FieldMap,
  allViews: ViewMap,
  viewsets: ViewSetMap
): FieldDependencyReference[] => {
  const affected: FieldDependencyReference[] = [];
  const {sectionToForm, fieldToSection} = buildFieldLocationMaps(
    allViews,
    viewsets
  );

  // Conditions can only reference fields within the same form, so scope scanning
  // to the viewset that contains fieldName.
  const fieldSection = fieldToSection.get(fieldName);
  const fieldFormId = fieldSection
    ? sectionToForm.get(fieldSection.sectionId)?.formId
    : undefined;
  const scopedViewset = fieldFormId ? viewsets[fieldFormId] : null;
  const scopedSectionIds = scopedViewset ? new Set(scopedViewset.views) : null;

  const scopedViews = scopedSectionIds
    ? Object.fromEntries(
        Object.entries(allViews).filter(([id]) => scopedSectionIds.has(id))
      )
    : allViews;

  const scopedFieldIds = new Set(
    Object.values(scopedViews).flatMap(s => s.fields)
  );
  const scopedFields = Object.fromEntries(
    Object.entries(allFields).filter(([id]) => scopedFieldIds.has(id))
  );

  // Check section-level conditions
  for (const [sectionId, sectionDef] of Object.entries(scopedViews)) {
    const condition = sectionDef.condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      const form = sectionToForm.get(sectionId);
      affected.push({
        type: 'section-condition',
        formId: form?.formId,
        formLabel: form?.formLabel,
        sectionId,
        sectionLabel: sectionDef.label,
      });
    }
  }

  // Check field-level conditions
  for (const [fId, fieldDef] of Object.entries(scopedFields)) {
    const condition = fieldDef.condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      const label = fieldDef['component-parameters']?.label ?? fId;
      const section = fieldToSection.get(fId);
      const form = section?.sectionId
        ? sectionToForm.get(section.sectionId)
        : undefined;
      affected.push({
        type: 'field-condition',
        formId: form?.formId,
        formLabel: form?.formLabel,
        sectionId: section?.sectionId,
        sectionLabel: section?.sectionLabel,
        fieldId: fId,
        fieldLabel: label,
      });
    }
  }

  // Check for Templated String Fields using the deleted field
  for (const [fId, fieldDef] of Object.entries(scopedFields)) {
    if (fieldDef['component-name'] === 'TemplatedStringField') {
      const template =
        (fieldDef['component-parameters'] as TemplatedStringProps).template ||
        '';

      if (template.includes(`{{${fieldName}}}`)) {
        const label = fieldDef['component-parameters']?.label ?? fId;
        const section = fieldToSection.get(fId);
        const form = section?.sectionId
          ? sectionToForm.get(section.sectionId)
          : undefined;
        affected.push({
          type: 'templated-string',
          formId: form?.formId,
          formLabel: form?.formLabel,
          sectionId: section?.sectionId,
          sectionLabel: section?.sectionLabel,
          fieldId: fId,
          fieldLabel: label,
          templateUsage: `{{${fieldName}}}`,
        });
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
 * @param allViews All sections (`views` map)
 * @param allFields All fields
 * @returns Array of strings describing external references
 */
export function findSectionExternalUsage(
  targetSectionId: string,
  allViews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  // 1. gather all fields that belong to the target section
  const targetFields = allViews[targetSectionId]?.fields || [];

  // 2. For each section in `views`
  for (const [sectionId, sectionDef] of Object.entries(allViews)) {
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
 * @param allViews All sections (`views` map)
 * @param allFields All fields
 * @returns Array of strings describing references from outside forms
 */
export function findFormExternalUsage(
  targetFormId: string,
  viewsets: Record<string, {label: string; views: string[]}>,
  allViews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  const targetFormDef = viewsets[targetFormId];
  if (!targetFormDef) return references;

  // 1. gather all fields across all sections in the target form
  const targetFields: string[] = [];
  for (const sectionId of targetFormDef.views) {
    targetFields.push(...(allViews[sectionId]?.fields || []));
  }

  // 2. For each form in viewsets
  for (const [formId, formDef] of Object.entries(viewsets)) {
    if (formId === targetFormId) continue; // skip same form

    // 2a. for each section in that form
    for (const secId of formDef.views) {
      const secDef = allViews[secId];
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
 * @param allViews All sections (`views` map) in the form
 * @returns An array of messages identifying conditions with missing expected values
 */
export function findInvalidConditionReferences(
  targetFieldName: string,
  targetField: FieldType,
  allFields: Record<string, FieldType>,
  allViews: Record<string, {label: string; condition?: ConditionType}>
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

  const elementProps = (
    targetField['component-parameters'] as {ElementProps?: ChoiceElementProps}
  ).ElementProps;
  const validOptions: string[] = (
    (elementProps?.options ?? []) as SelectableConditionOption[]
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
  for (const [, viewDef] of Object.entries(allViews)) {
    const cond = viewDef.condition;
    if (cond && isFieldUsedInCondition(cond, targetFieldName)) {
      const invalidVals = getInvalidExpectedValue(cond);
      if (invalidVals.length > 0) {
        invalidVals.forEach(invalidVal => {
          invalidConditions.push(`Section: ${viewDef.label} (${invalidVal})`);
        });
      }
    }
  }

  return invalidConditions;
}
