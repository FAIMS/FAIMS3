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

import {
  Grid,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Stack,
  Divider,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Dialog,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {useAppSelector} from '../state/hooks';
import {FieldType} from '../state/initial';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SplitscreenIcon from '@mui/icons-material/Splitscreen';
import QuizIcon from '@mui/icons-material/Quiz';
import {useState, useMemo} from 'react';

// Defines the Condition component to create a conditional expression
// that can be attached to a View or Field (and maybe more)

export type ConditionType = {
  operator: string;
  field?: string;
  value?: unknown;
  conditions?: ConditionType[];
};

type ConditionProps = {
  onChange?: (v: ConditionType | null) => void;
  initial?: ConditionType | null;
  field?: string; // the field this condition will attach to
  view?: string; // the view this condition will attach to
};

const EMPTY_FIELD_CONDITION = {operator: 'equal', field: '', value: ''};
const EMPTY_BOOLEAN_CONDITION = {operator: 'and', conditions: []};

const allOperators = new Map([
  ['equal', 'Equal to'],
  ['not-equal', 'Not equal to'],
  ['greater', 'Greater than'],
  ['greater-equal', 'Greater than or equal'],
  ['less', 'Less than'],
  ['less-equal', 'Less than or equal'],
  ['regex', 'Matches regular expression'],
  ['contains', 'List contains this value'],
  ['does-not-contain', 'List does not contain this value'],
  ['contains-regex', 'List contains a value matching this regex'],
  [
    'does-not-contain-regex',
    'List does not contain any value matching this regex',
  ],
  ['contains-one-of', 'List contains one of these values'],
  ['does-not-contain-any-of', 'List does not contain any of these values'],
  ['contains-all-of', 'List contains all of these values'],
  ['does-not-contain-all-of', 'List does not contain all of these values'],
]);

const getFieldLabel = (f: FieldType) => {
  return (
    (f['component-parameters'].InputLabelProps &&
      f['component-parameters'].InputLabelProps.label) ||
    f['component-parameters'].name
  );
};

// Recursively checks if a field is used in a single condition
export function isFieldUsedInCondition(
  condition: ConditionType | null | undefined,
  fieldName: string
): boolean {
  if (!condition) return false;

  const {operator, field, conditions} = condition;

  // Base case
  if (field === fieldName) {
    return true;
  }

  // If it's an AND/OR group, check subconditions
  if ((operator === 'and' || operator === 'or') && conditions) {
    return conditions.some(sub => isFieldUsedInCondition(sub, fieldName));
  }

  return false;
}

/**
 * Finds where a field is used in conditions or templated string fields
 */
export const findFieldCondtionUsage = (
  fieldName: string,
  allFields: Record<string, any>,
  allFviews: Record<string, any>
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
  allFviews: Record<
    string,
    {label: string; condition?: ConditionType; fields: string[]}
  >,
  allFields: Record<string, any>
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
  allFviews: Record<
    string,
    {label: string; condition?: ConditionType; fields: string[]}
  >,
  allFields: Record<string, any>
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

  const validOptions: string[] =
    targetField['component-parameters'].ElementProps?.options?.map(
      (opt: any) => opt.value
    ) || [];

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

/**
 * Finds all conditions that reference the old option value in a specific field.
 */
export function findOptionReferences(
  allFields: Record<string, FieldType>,
  allFviews: Record<string, {label: string; condition?: ConditionType}>,
  fieldName: string,
  oldValue: string
): string[] {
  const references: string[] = [];

  // Check field conditions
  for (const fieldId in allFields) {
    const fieldCondition = allFields[fieldId].condition;
    if (
      fieldCondition &&
      doesConditionContainValue(fieldCondition, fieldName, oldValue)
    ) {
      const label = allFields[fieldId]['component-parameters'].label ?? fieldId;
      references.push(`Field: ${label}`);
    }
  }

  // Check section conditions
  for (const sectionId in allFviews) {
    const sectionCondition = allFviews[sectionId].condition;
    if (
      sectionCondition &&
      doesConditionContainValue(sectionCondition, fieldName, oldValue)
    ) {
      references.push(`Section: ${allFviews[sectionId].label}`);
    }
  }

  return references;
}

/**
 * Checks if a condition contains a specific value for a given field.
 */
function doesConditionContainValue(
  condition: ConditionType,
  fieldName: string,
  oldValue: string
): boolean {
  const {operator, field, value, conditions} = condition;

  if ((operator === 'and' || operator === 'or') && conditions) {
    return conditions.some(c =>
      doesConditionContainValue(c, fieldName, oldValue)
    );
  }

  if (field === fieldName) {
    if (Array.isArray(value)) {
      return value.includes(oldValue);
    } else {
      return value === oldValue;
    }
  }

  return false;
}

/**
 * Updates all references of oldValue to newValue in a condition.
 */
export function updateConditionReferences(
  condition: ConditionType,
  fieldName: string,
  oldValue: string,
  newValue: string
): ConditionType {
  const {operator, field, value, conditions} = condition;

  if ((operator === 'and' || operator === 'or') && conditions) {
    return {
      ...condition,
      conditions: conditions.map(c =>
        updateConditionReferences(c, fieldName, oldValue, newValue)
      ),
    };
  }

  if (field === fieldName) {
    if (Array.isArray(value)) {
      return {
        ...condition,
        value: value.map(v => (v === oldValue ? newValue : v)),
      };
    } else if (value === oldValue) {
      return {...condition, value: newValue};
    }
  }

  return condition;
}

export const ConditionModal = (props: ConditionProps & {label: string}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="small"
        startIcon={<QuizIcon />}
      >
        {props.label}
      </Button>
      <Dialog open={open} fullWidth={true} maxWidth="lg">
        <ConditionControl
          initial={props.initial}
          onChange={props.onChange}
          field={props.field}
          view={props.view}
        />

        <Button onClick={() => setOpen(false)}>Close</Button>
      </Dialog>
    </>
  );
};

export const ConditionTranslation = (props: {condition: ConditionType}) => {
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
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

export const ConditionControl = (props: ConditionProps) => {
  const initial = props.initial || EMPTY_FIELD_CONDITION;

  const [condition, setCondition] = useState<ConditionType | null>(initial);

  const conditionChanged = (condition: ConditionType | null) => {
    setCondition(condition);
    if (props.onChange !== undefined) props.onChange(condition);
  };

  if (condition === null) return <p>Empty Condition</p>;
  else {
    const isBoolean =
      condition.operator === 'and' || condition.operator === 'or';
    return (
      <Stack
        direction="row"
        spacing={2}
        sx={{border: '1px dashed grey', padding: '10px'}}
      >
        {isBoolean ? (
          <BooleanConditionControl
            onChange={conditionChanged}
            initial={condition}
            field={props.field}
            view={props.view}
          />
        ) : (
          <FieldConditionControl
            onChange={conditionChanged}
            initial={condition}
            field={props.field}
            view={props.view}
          />
        )}
      </Stack>
    );
  }
};

const BooleanConditionControl = (props: ConditionProps) => {
  const initial: ConditionType = useMemo(
    () => props.initial || EMPTY_BOOLEAN_CONDITION,
    [props]
  );

  const [condition, setCondition] = useState<ConditionType | null>(initial);

  const updateOperator = (value: string) => {
    updateCondition({...condition, operator: value});
  };

  const updateCondition = (cond: ConditionType | null) => {
    const newCond = cond === null ? EMPTY_FIELD_CONDITION : cond;
    setCondition(newCond);
    if (newCond && props.onChange) {
      props.onChange(newCond);
    }
  };

  // callback for each condition inside the boolean
  const conditionCallback = (index: number) => {
    return (value: ConditionType | null) => {
      if (condition && condition.conditions) {
        if (value === null) {
          const newConditions = condition.conditions.filter(
            (_v: ConditionType, i: number) => {
              return i !== index;
            }
          );
          if (newConditions.length === 0)
            updateCondition(EMPTY_FIELD_CONDITION);
          else updateCondition({...condition, conditions: newConditions});
        } else {
          const newConditions = condition.conditions.map(
            (v: ConditionType, i: number) => {
              if (i === index) return value;
              else return v;
            }
          );
          updateCondition({...condition, conditions: newConditions});
        }
      } else if (condition) {
        if (value) updateCondition({...condition, conditions: [value]});
        else updateCondition(EMPTY_FIELD_CONDITION);
      }
    };
  };

  const addCondition = () => {
    if (condition) {
      const existing = condition.conditions || [];
      // construct a condition with a new empty field condition
      const newCondition = {
        ...condition,
        conditions: [...existing, EMPTY_FIELD_CONDITION],
      };
      updateCondition(newCondition);
    }
  };

  const deleteCondition = () => {
    updateCondition(EMPTY_FIELD_CONDITION);
  };

  if (condition)
    return (
      <Stack direction="row" spacing={2}>
        <Stack direction="column" spacing={2}>
          {condition.conditions ? (
            condition.conditions.map((cond: ConditionType, index: number) => (
              <ConditionControl
                key={index}
                onChange={conditionCallback(index)}
                initial={cond}
                field={props.field}
                view={props.view}
              />
            ))
          ) : (
            <div></div>
          )}
          <Tooltip describeChild title="Add another condition">
            <Button variant="outlined" color="primary" onClick={addCondition}>
              Add another condition
            </Button>
          </Tooltip>
        </Stack>
        <Stack direction="column" spacing={2}>
          <FormControl sx={{minWidth: 100}}>
            <InputLabel id="operator">Operator</InputLabel>
            <Select
              labelId="operator"
              label="Operator"
              onChange={e => updateOperator(e.target.value)}
              value={condition.operator}
            >
              <MenuItem key="and" value="and">
                and
              </MenuItem>
              <MenuItem key="or" value="or">
                or
              </MenuItem>
            </Select>
          </FormControl>

          <Tooltip describeChild title="Remove this boolean condition">
            <IconButton color="secondary" onClick={deleteCondition}>
              <RemoveCircleIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    );
  else return <div></div>;
};

export const FieldConditionControl = (props: ConditionProps) => {
  const initialValue = useMemo(
    () =>
      props.initial || {
        field: '',
        operator: 'equal',
        value: '',
      },
    [props]
  );
  const [condition, setCondition] = useState(initialValue);

  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
  );
  const views = useAppSelector(
    state => state.notebook['ui-specification'].fviews
  );

  // work out which fields to show in the select, remove either
  // the current field or the fields in the current view
  let selectFields = Object.keys(allFields);
  if (props.field) {
    selectFields = selectFields.filter(f => f !== props.field);
  } else if (props.view) {
    const view = views[props.view];
    selectFields = selectFields.filter(f => view.fields.indexOf(f) < 0);
  }

  const targetFieldDef = condition.field ? allFields[condition.field] : null;

  /* Checks if a field has predefined options */
  const isPredefinedOptions = (fieldDef: FieldType | null): boolean => {
    if (!fieldDef) return false;
    return ['Select', 'RadioGroup', 'MultiSelect', 'Checkbox'].includes(
      fieldDef['component-name']
    );
  };

  const updateField = (value: string) => {
    const newFieldDef = allFields[value] ?? null;
    if (newFieldDef && newFieldDef['component-name'] === 'Checkbox') {
      updateCondition({
        field: value,
        operator: 'equal',
        value: true,
      });
    } else {
      const isPredefinedOptionsField =
        newFieldDef && isPredefinedOptions(newFieldDef);

      let firstOption = '';
      if (isPredefinedOptionsField) {
        const options =
          newFieldDef?.['component-parameters']?.ElementProps?.options ?? [];
        if (options.length > 0) {
          firstOption = options[0].value;
        }
      }

      updateCondition({
        field: value,
        operator: isPredefinedOptionsField ? 'equal' : condition.operator,
        value: firstOption,
      });
    }
  };

  const updateOperator = (value: string) => {
    updateCondition({...condition, operator: value});
  };

  const updateValue = (value: unknown) => {
    updateCondition({...condition, value: value});
  };

  const updateCondition = (condition: ConditionType) => {
    setCondition(condition);
    if (
      props.onChange &&
      condition.field &&
      condition.operator &&
      condition.value !== undefined
    ) {
      props.onChange(condition);
    }
  };

  const getFieldLabel = (f: FieldType) =>
    f?.['component-parameters']?.InputLabelProps?.label ||
    f?.['component-parameters']?.name ||
    '<unlabeled>';

  const renderValueEditor = (fieldDef: FieldType) => {
    const cName = fieldDef['component-name'];
    const params = fieldDef['component-parameters'] || {};
    const possibleOptions = params.ElementProps?.options || [];

    if (
      cName !== 'Select' &&
      cName !== 'RadioGroup' &&
      cName !== 'MultiSelect' &&
      cName !== 'Checkbox'
    ) {
      return (
        <TextField
          variant="outlined"
          label="Value"
          value={condition.value ?? ''}
          onChange={e => updateValue(e.target.value)}
          sx={{minWidth: 200}}
        />
      );
    }

    switch (cName) {
      case 'Select':
      case 'RadioGroup': {
        const isValidOption = possibleOptions.some(
          (opt: any) => opt.value === condition.value
        );
        return (
          <FormControl sx={{minWidth: 200}} error={!isValidOption}>
            <InputLabel>Value</InputLabel>
            <Select
              label="Value"
              value={isValidOption ? condition.value : (condition.value ?? '')}
              onChange={e => updateValue(e.target.value)}
            >
              {possibleOptions.map((opt: any) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {!isValidOption && (
              <div style={{color: 'red', fontSize: '12px'}}>
                Invalid value: "{String(condition.value)}"
              </div>
            )}
          </FormControl>
        );
      }
      case 'MultiSelect': {
        const selectedValues = Array.isArray(condition.value)
          ? condition.value
          : [];
        const areAllValid = selectedValues.every(v =>
          possibleOptions.some((opt: any) => opt.value === v)
        );
        return (
          <FormControl sx={{minWidth: 200}} error={!areAllValid}>
            <InputLabel>Value</InputLabel>
            <Select
              multiple
              label="Value"
              value={selectedValues}
              onChange={e => updateValue(e.target.value)}
            >
              {possibleOptions.map((opt: any) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {selectedValues.some(
              v => !possibleOptions.some((opt: any) => opt.value === v)
            ) && (
              <div style={{color: 'red', fontSize: '12px'}}>
                Invalid values: "
                {selectedValues
                  .filter(
                    v => !possibleOptions.some((opt: any) => opt.value === v)
                  )
                  .join(', ')}
                "
              </div>
            )}
          </FormControl>
        );
      }
      case 'Checkbox': {
        let booleanValue = condition.value;
        if (typeof booleanValue !== 'boolean') {
          booleanValue = true;
        }
        return (
          <FormControl sx={{minWidth: 200}}>
            <InputLabel>Value</InputLabel>
            <Select
              label="Value"
              value={booleanValue ? 'true' : 'false'}
              onChange={e => updateValue(e.target.value === 'true')}
            >
              <MenuItem value="true">Checked</MenuItem>
              <MenuItem value="false">Not Checked</MenuItem>
            </Select>
          </FormControl>
        );
      }
      default: {
        if (possibleOptions.length === 0) {
          return (
            <TextField
              variant="outlined"
              label="Value"
              value={condition.value ?? ''}
              onChange={e => updateValue(e.target.value)}
              sx={{minWidth: 200}}
            />
          );
        } else {
          const isValidOption = possibleOptions.some(
            (opt: any) => opt.value === condition.value
          );
          return (
            <TextField
              variant="outlined"
              label="Value"
              value={condition.value ?? ''}
              onChange={e => updateValue(e.target.value)}
              sx={{minWidth: 200}}
              error={!isValidOption}
              helperText={
                !isValidOption ? `Invalid value: "${condition.value}"` : ''
              }
            />
          );
        }
      }
    }
  };

  const isValueValidForField = (): boolean => {
    if (!targetFieldDef) return true;
    const cName = targetFieldDef['component-name'];
    const params = targetFieldDef['component-parameters'] || {};
    const possibleOptions = params.ElementProps?.options || [];

    if (cName === 'Select' || cName === 'RadioGroup') {
      return possibleOptions.some((o: any) => o.value === condition.value);
    }
    if (cName === 'MultiSelect') {
      if (!Array.isArray(condition.value)) return false;
      return (condition.value as any[]).every((val: any) =>
        possibleOptions.some((o: any) => o.value === val)
      );
    }
    if (cName === 'Checkbox') {
      return condition.value === true || condition.value === false;
    }
    return true;
  };

  const handleSplitCondition = () => {
    if (props.onChange) {
      props.onChange({
        operator: 'and',
        conditions: [condition, {field: '', operator: 'equal', value: ''}],
      });
    }
  };

  const deleteCondition = () => {
    if (props.onChange) {
      props.onChange(null);
    }
  };

  const valueMismatch = !isValueValidForField();
    const allowedOperators = targetFieldDef
    ? (() => {
        const cName = targetFieldDef['component-name'];
        if (cName === 'MultiSelect')
          return [
            'contains-one-of',
            'does-not-contain-any-of',
            'contains-all-of',
            'does-not-contain-all-of',
          ];
        if (cName === 'Checkbox') return ['equal'];
        if (isPredefinedOptions(targetFieldDef)) return ['equal', 'not-equal'];
        return ['equal', 'not-equal', 'greater', 'less', 'contains', 'regex'];
      })()
    : [];

  return (
    <Grid container>
      <Stack
        direction="row"
        spacing={2}
        divider={<Divider orientation="vertical" flexItem />}
      >
        <Autocomplete
          options={selectFields}
          getOptionLabel={(fieldId: string) => getFieldLabel(allFields[fieldId])}
          value={condition.field || null}
          onChange={(event, newValue) => {
            updateField(newValue || '');
          }}
          renderInput={(params) => (
            <TextField {...params} label="Field" variant="outlined" />
          )}
          style={{ minWidth: 200 }}
          clearOnEscape
        />

        <FormControl
          sx={{minWidth: 200}}
          data-testid="operator-input"
          disabled={allowedOperators.length === 1}
        >
          <InputLabel id="operator">Operator</InputLabel>
          <Select
            labelId="operator"
            label="Operator"
            onChange={e => updateOperator(e.target.value)}
            value={condition.operator}
          >
           {allowedOperators.map(op => (
              <MenuItem key={op} value={op}>
                {op}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {targetFieldDef ? (
          renderValueEditor(targetFieldDef)
        ) : (
          <TextField label="Value" sx={{minWidth: 200}} />
        )}

        <Tooltip describeChild title="Make this an 'and' or 'or' condition">
          <IconButton
            color="primary"
            onClick={handleSplitCondition}
            data-testid="split-button"
          >
            <SplitscreenIcon />
          </IconButton>
        </Tooltip>
        <Tooltip describeChild title="Remove this condition">
          <IconButton
            color="secondary"
            onClick={deleteCondition}
            data-testid="delete-button"
          >
            <RemoveCircleIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      {valueMismatch && <div style={{color: 'red'}}>Invalid value!</div>}
    </Grid>
  );
};
