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

import {useConditionRuleFieldContext} from '@/hooks/use-condition-field-context';
import type {ChoiceElementProps} from '@faims3/forms';
import {
  Box,
  Checkbox,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import {useRef, useState} from 'react';
import type {FieldType} from '../../state/initial';
import {
  allOperators,
  ConditionRuleOperator,
  operatorDetails,
  RuleCondition,
  type ConditionRuleNode,
  type SelectableConditionOption,
} from '../../types/condition';
import {FieldSearchAutocomplete} from '../field-selector';

// helper functions for condition rule inputs:

/** Options from a Select/Radio/Multi field usable as condition RHS values. */
const getSelectableOptions = (
  fieldDef: FieldType
): SelectableConditionOption[] =>
  ((fieldDef['component-parameters'] as {ElementProps?: ChoiceElementProps})
    .ElementProps?.options ?? []) as SelectableConditionOption[];

/* Checks if a field has predefined options */
const isPredefinedOptions = (fieldDef: FieldType | null): boolean => {
  if (!fieldDef) return false;
  return ['Select', 'RadioGroup', 'MultiSelect', 'Checkbox'].includes(
    fieldDef['component-name']
  );
};

const isNumberOrDateField = (fieldDef: FieldType | null): boolean => {
  if (!fieldDef) return false;
  // list our current number/date fields
  // note that dates are stored as strings but we can still do greater/less comparisons on them
  return [
    'NumberField',
    'PercentageSlider',
    'DateTimePicker',
    'DatePicker',
    'MonthPicker',
    'DateTimeNow',
  ].includes(fieldDef['component-name']);
};

/** Operators whose condition value is a list of options, not a single value. */
const isMultiValueOperator = (operator: ConditionRuleOperator): boolean =>
  operator === 'is-one-of' || operator === 'is-not-one-of';

/**
 * Converts the stored rule value when switching between a single-value
 * operator (string) and a multi-value operator (string[]).
 */
const coerceValueForOperator = (
  value: unknown,
  nextOperator: ConditionRuleOperator
): unknown => {
  if (isMultiValueOperator(nextOperator)) {
    if (Array.isArray(value)) return value;
    if (value === '' || value === undefined || value === null) return [];
    return [value];
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : '';
  }

  return value;
};

// Get the allowed operators for a field based on its type and parameters
const getAllowedOperatorsForField = (
  fieldDef: FieldType | null
): ConditionRuleOperator[] => {
  if (!fieldDef) return [];

  const cName = fieldDef['component-name'];

  if (cName === 'MultiSelect') {
    // these are the array operators
    return [
      'contains-one-of',
      'does-not-contain-any-of',
      'contains-all-of',
      'does-not-contain-all-of',
      'contains-regex',
      'does-not-contain-regex',
    ];
  }
  // Checkbox is true/false so only equal makes sense
  if (cName === 'Checkbox') return ['equal'];
  // Select single: equality, or membership in a list of options
  if (cName === 'Select' || cName === 'RadioGroup') {
    return ['equal', 'not-equal', 'is-one-of', 'is-not-one-of'];
  }
  // Other option fields (none currently) keep equality only
  if (isPredefinedOptions(fieldDef)) return ['equal', 'not-equal'];
  // Fields we can compare order for (numbers, dates) get greater/less as well
  if (isNumberOrDateField(fieldDef)) {
    return ['equal', 'not-equal', 'greater', 'less'];
  }
  // otherwise use all string valued operators
  return [
    'equal',
    'not-equal',
    'greater',
    'less',
    'string-contains',
    'string-does-not-contain',
    'regex',
  ];
};

/**
 * Picks a sensible initial value when the user selects a target field.
 */
const getDefaultValueForField = (fieldDef: FieldType | null): unknown => {
  if (!fieldDef) return '';

  if (fieldDef['component-name'] === 'Checkbox') return true;

  if (isPredefinedOptions(fieldDef)) {
    const options = getSelectableOptions(fieldDef);
    if (options.length <= 0) return '';

    return fieldDef['component-name'] === 'MultiSelect'
      ? [options[0].value]
      : options[0].value;
  }

  return '';
};

/**
 * Checks whether the stored condition value still matches the target field's
 * current option list.
 */
const isValueValidForField = (
  // targetFieldDef
  fieldDef: FieldType | null,
  // condition rule value
  value: unknown,
  operator?: ConditionRuleOperator
): boolean => {
  if (!fieldDef) return true;

  const cName = fieldDef['component-name'];
  const params = (fieldDef['component-parameters'] || {}) as {
    ElementProps?: ChoiceElementProps;
  };
  const possibleOptions =
    (params.ElementProps?.options as SelectableConditionOption[] | undefined) ??
    [];
  const enableOtherOption = params.ElementProps?.enableOtherOption ?? false;

  if (
    enableOtherOption &&
    ['Select', 'MultiSelect', 'RadioGroup'].includes(cName)
  ) {
    return true;
  }

  const isListedOption = (item: unknown) =>
    possibleOptions.some(option => option.value === item);

  if (cName === 'Select' || cName === 'RadioGroup') {
    if (operator && isMultiValueOperator(operator)) {
      if (!Array.isArray(value)) return false;
      return value.every(isListedOption);
    }
    return isListedOption(value);
  }

  if (cName === 'MultiSelect') {
    if (!Array.isArray(value)) return false;

    return value.every(isListedOption);
  }

  if (cName === 'Checkbox') {
    return value === true || value === false;
  }

  return true;
};

/**
 * Multi-option value picker used by MultiSelect conditions and by
 * is-one-of / is-not-one-of on Select single fields.
 */
const MultiValueSelect = (props: {
  editorId: string;
  value: unknown;
  possibleOptions: SelectableConditionOption[];
  valueMismatch: boolean;
  showLabels: boolean;
  onChange: (nextValue: RuleCondition['value']) => void;
}) => {
  const {
    editorId,
    value,
    possibleOptions,
    valueMismatch,
    showLabels,
    onChange,
  } = props;
  const selectedValues = Array.isArray(value) ? (value as string[]) : [];
  const valueLabelId = `condition-value-label-${editorId}`;

  return (
    <FormControl sx={{minWidth: 0, width: '100%'}} error={valueMismatch}>
      {showLabels && <InputLabel id={valueLabelId}>Value</InputLabel>}
      <Select
        multiple
        data-testid="value-input"
        labelId={showLabels ? valueLabelId : undefined}
        label={showLabels ? 'Value' : undefined}
        value={selectedValues}
        onChange={event => {
          const nextValue = event.target.value;
          onChange(
            typeof nextValue === 'string' ? nextValue.split(',') : nextValue
          );
        }}
        renderValue={selected =>
          selected
            .map(selectedValue => {
              const option = possibleOptions.find(
                item => item.value === selectedValue
              );
              return option ? option.label : selectedValue;
            })
            .join(', ')
        }
      >
        {possibleOptions.map(option => (
          <MenuItem key={option.value} value={option.value}>
            <Checkbox checked={selectedValues.includes(option.value)} />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>

      {valueMismatch && (
        <FormHelperText>
          Invalid values: "
          {selectedValues
            .filter(v => !possibleOptions.some(opt => opt.value === v))
            .join(', ')}
          "
        </FormHelperText>
      )}
    </FormControl>
  );
};

/**
 * Renders the value input for a condition rule.
 *
 * The input type depends on the selected field component and operator:
 * - text input for free-text, number, and date-like fields
 * - select input for single-choice fields (equal / not-equal)
 * - multi-select input for MultiSelect fields and is-one-of / is-not-one-of
 * - boolean select input for Checkbox fields
 */
const ValueEditor = (props: {
  fieldDef: FieldType;
  editorId: string;
  operator: ConditionRuleOperator;
  value: unknown;
  valueMismatch: boolean;
  onChange: (patch: Partial<RuleCondition>) => void;
  showLabels?: boolean;
}) => {
  const {
    fieldDef,
    editorId,
    operator,
    value,
    valueMismatch,
    onChange,
    showLabels = false,
  } = props;

  const componentName = fieldDef['component-name'];
  const params = (fieldDef['component-parameters'] || {}) as {
    ElementProps?: ChoiceElementProps;
  };
  const possibleOptions =
    (params.ElementProps?.options as SelectableConditionOption[] | undefined) ??
    [];

  const updateValue = (nextValue: RuleCondition['value']) => {
    onChange({value: nextValue});
  };

  const valueLabelId = `condition-value-label-${editorId}`;

  switch (componentName) {
    /**
     * Single-choice fields: a normal Select, or a multi-select when the
     * operator compares against a list of options.
     */
    case 'Select':
    case 'RadioGroup': {
      if (isMultiValueOperator(operator)) {
        return (
          <MultiValueSelect
            editorId={editorId}
            value={value}
            possibleOptions={possibleOptions}
            valueMismatch={valueMismatch}
            showLabels={showLabels}
            onChange={updateValue}
          />
        );
      }

      const hasValue = value !== '' && value !== undefined && value !== null;
      const isValidOption = possibleOptions.some(
        option => option.value === value
      );

      return (
        <FormControl
          sx={{minWidth: 0, width: '100%'}}
          error={hasValue && !isValidOption}
        >
          {showLabels && <InputLabel id={valueLabelId}>Value</InputLabel>}
          <Select
            data-testid="value-input"
            labelId={showLabels ? valueLabelId : undefined}
            label={showLabels ? 'Value' : undefined}
            value={isValidOption ? value : (value ?? '')}
            onChange={event => updateValue(event.target.value)}
          >
            {possibleOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>

          {hasValue && !isValidOption && (
            <FormHelperText>Invalid value: "{String(value)}"</FormHelperText>
          )}
        </FormControl>
      );
    }

    /**
     * MultiSelect values are stored as an array.
     */
    case 'MultiSelect': {
      return (
        <MultiValueSelect
          editorId={editorId}
          value={value}
          possibleOptions={possibleOptions}
          valueMismatch={valueMismatch}
          showLabels={showLabels}
          onChange={updateValue}
        />
      );
    }

    /**
     * Checkbox conditions compare against checked / not checked.
     */
    case 'Checkbox': {
      const booleanValue = typeof value === 'boolean' ? value : true;

      return (
        <FormControl sx={{minWidth: 0, width: '100%'}}>
          {showLabels && <InputLabel id={valueLabelId}>Value</InputLabel>}
          <Select
            data-testid="value-input"
            labelId={showLabels ? valueLabelId : undefined}
            label={showLabels ? 'Value' : undefined}
            value={booleanValue ? 'true' : 'false'}
            onChange={event => updateValue(event.target.value === 'true')}
          >
            <MenuItem value="true">Checked</MenuItem>
            <MenuItem value="false">Not Checked</MenuItem>
          </Select>
        </FormControl>
      );
    }

    /**
     * Default fallback.
     */
    default: {
      if (possibleOptions.length === 0) {
        return (
          <TextField
            variant="outlined"
            data-testid="value-input"
            label={showLabels ? 'Value' : undefined}
            placeholder="Value"
            value={value ?? ''}
            onChange={event => updateValue(event.target.value)}
            sx={{minWidth: 0, width: '100%'}}
          />
        );
      }

      const hasValue = value !== '' && value !== undefined && value !== null;
      const isValidOption = possibleOptions.some(
        option => option.value === value
      );

      return (
        <TextField
          variant="outlined"
          label={showLabels ? 'Value' : undefined}
          placeholder="Value"
          data-testid="value-input"
          value={value ?? ''}
          onChange={event => updateValue(event.target.value)}
          sx={{minWidth: 0, width: '100%'}}
          error={hasValue && !isValidOption}
          helperText={
            hasValue && !isValidOption
              ? `Invalid value: "${String(value)}"`
              : ''
          }
        />
      );
    }
  }
};

/**
 * Renders the inputs for a single condition rule row.
 *
 * The user selects:
 * - a target field
 * - an operator valid for that field type
 * - a value using the appropriate value editor
 *
 * Field selection is scoped to the current field or section context. Changes
 * are returned as partial rule patches so the parent editor can update the tree.
 */
export type ConditionRuleInputsProps = {
  rule: ConditionRuleNode;
  // update conition rule
  onChange: (patch: Partial<RuleCondition>) => void;
  field?: string;
  view?: string;
  showLabels?: boolean;
};

export const ConditionRuleInputs = (props: ConditionRuleInputsProps) => {
  const {rule, onChange, field, view, showLabels} = props;

  const {allFields, fieldSearchScope, referenceEntries} =
    useConditionRuleFieldContext({
      field,
      view,
    });

  // Reference the operator input so the dropdown can match its width.
  const operatorControlRef = useRef<HTMLDivElement>(null);
  // Stores the current width of the operator input.
  const [operatorMenuWidth, setOperatorMenuWidth] = useState<
    number | undefined
  >(undefined);

  // Measure the operator input each time the dropdown opens.
  const updateOperatorMenuWidth = () => {
    setOperatorMenuWidth(
      operatorControlRef.current?.getBoundingClientRect().width
    );
  };

  const targetFieldDef = rule.field ? (allFields[rule.field] ?? null) : null;
  const allowedOperators = getAllowedOperatorsForField(targetFieldDef);
  const valueMismatch = !isValueValidForField(
    targetFieldDef,
    rule.value,
    rule.operator
  );

  const operatorOptions = allowedOperators.map(operator => ({
    value: operator,
    label: allOperators.get(operator) ?? operator,
    description: operatorDetails[operator]?.description,
    example: operatorDetails[operator]?.example,
  }));

  const showOperatorLabel = showLabels && allowedOperators.length > 0;

  /**
   * When the field changes, also reset operator/value to something valid for
   * the new field type.
   */
  const updateField = (fieldId: string) => {
    const nextFieldDef = allFields[fieldId] ?? null;
    const nextAllowedOperators = getAllowedOperatorsForField(nextFieldDef);

    const nextOperator = nextAllowedOperators.includes(rule.operator)
      ? rule.operator
      : (nextAllowedOperators[0] ?? 'equal');

    onChange({
      field: fieldId,
      operator: nextOperator,
      value: getDefaultValueForField(nextFieldDef),
    });
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
        },
        gap: 2,
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* Field input */}
      <Box sx={{minWidth: 0, width: '100%'}}>
        <FieldSearchAutocomplete
          value={rule.field || null}
          onChange={fieldId => updateField(fieldId || '')}
          scope={fieldSearchScope}
          extraEntries={referenceEntries}
          data-testid="field-input"
          label={showLabels ? 'Field' : undefined}
          placeholder="Field"
        />
      </Box>

      {/* Operator selector */}
      <FormControl
        // Used to measure the operator input width.
        ref={operatorControlRef}
        sx={{minWidth: 0, width: '100%'}}
        data-testid="operator-input"
        disabled={allowedOperators.length === 0}
      >
        {showOperatorLabel && (
          <InputLabel id={`condition-rule-operator-label-${rule.editorId}`}>
            Operator
          </InputLabel>
        )}
        <Select
          displayEmpty
          labelId={
            showOperatorLabel
              ? `condition-rule-operator-label-${rule.editorId}`
              : undefined
          }
          label={showOperatorLabel ? 'Operator' : undefined}
          value={allowedOperators.includes(rule.operator) ? rule.operator : ''}
          renderValue={selected => {
            if (!selected) {
              return (
                <Box component="span" sx={{color: 'text.disabled'}}>
                  Operator
                </Box>
              );
            }

            return allOperators.get(selected)?.toLowerCase() ?? selected;
          }}
          onChange={event => {
            const nextOperator = event.target
              .value as ConditionRuleNode['operator'];
            onChange({
              operator: nextOperator,
              value: coerceValueForOperator(rule.value, nextOperator),
            });
          }}
          onOpen={updateOperatorMenuWidth}
          MenuProps={{
            slotProps: {
              paper: {
                sx: {
                  // Keep the dropdown the same width as the operator input.
                  width: operatorMenuWidth,
                  maxWidth: operatorMenuWidth,
                },
              },
            },
          }}
        >
          {operatorOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>
              <ListItemText
                primary={option.label}
                secondary={
                  <>
                    <Box component="span">{option.description}</Box>

                    {option.example && (
                      <Box component="span" sx={{display: 'block'}}>
                        <Box component="span" sx={{fontWeight: 700}}>
                          Example:{' '}
                        </Box>
                        {option.example}
                      </Box>
                    )}
                  </>
                }
                slotProps={{
                  primary: {
                    sx: {
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    },
                  },
                  secondary: {
                    component: 'div',
                    sx: {
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    },
                  },
                }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Value input */}
      {targetFieldDef ? (
        <ValueEditor
          fieldDef={targetFieldDef}
          editorId={rule.editorId}
          operator={rule.operator}
          value={rule.value}
          valueMismatch={valueMismatch}
          onChange={onChange}
          showLabels={showLabels}
        />
      ) : (
        <TextField
          disabled
          label={showLabels ? 'Value' : undefined}
          placeholder="Value"
          sx={{minWidth: 0, width: '100%'}}
        />
      )}
    </Box>
  );
};
