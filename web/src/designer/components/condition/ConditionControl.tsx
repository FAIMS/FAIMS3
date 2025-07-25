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
  Button,
  Checkbox,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {useMemo, useState} from 'react';
import {useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {EMPTY_BOOLEAN_CONDITION, EMPTY_FIELD_CONDITION} from './constants';
import {ConditionProps, ConditionType} from './types';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SplitscreenIcon from '@mui/icons-material/Splitscreen';
import {getFieldLabel} from './utils';

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
      // Duplicate the first existing condition (or use empty condition if none)
      const template =
        existing.length > 0
          ? JSON.parse(JSON.stringify(existing[0]))
          : {...EMPTY_FIELD_CONDITION};

      const newCondition = {
        ...condition,
        conditions: [...existing, template],
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
    state => state.notebook['ui-specification'].present.fields
  );
  const views = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
  );

  // work out which fields to show in the select/combobox, remove either
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

    const allowedOperators = newFieldDef
      ? (() => {
          const cName = newFieldDef['component-name'];
          if (cName === 'MultiSelect')
            return [
              'contains-one-of',
              'does-not-contain-any-of',
              'contains-all-of',
              'does-not-contain-all-of',
            ];
          if (cName === 'Checkbox') return ['equal'];
          if (isPredefinedOptions(newFieldDef)) return ['equal', 'not-equal'];
          return ['equal', 'not-equal', 'greater', 'less', 'contains', 'regex'];
        })()
      : [];

    let newOperator = condition.operator;
    if (
      allowedOperators.length > 0 &&
      !allowedOperators.includes(newOperator)
    ) {
      newOperator = allowedOperators[0];
    }

    let newValue: any = '';
    if (newFieldDef) {
      if (newFieldDef['component-name'] === 'Checkbox') {
        newValue = true;
      } else if (isPredefinedOptions(newFieldDef)) {
        const options =
          newFieldDef['component-parameters']?.ElementProps?.options ?? [];
        if (options.length > 0) {
          if (newFieldDef['component-name'] === 'MultiSelect') {
            newValue = [options[0].value];
          } else {
            newValue = options[0].value;
          }
        }
      }
    }

    updateCondition({
      field: value,
      operator: newOperator,
      value: newValue,
    });
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
          data-testid="value-input"
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
              data-testid="value-input"
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
            {!isValidOption && condition.value !== '' && (
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
              data-testid="value-input"
              label="Value"
              value={selectedValues}
              onChange={e => updateValue(e.target.value)}
              // Render selected values as labels
              renderValue={selected => {
                const selectedLabels = (selected as string[]).map(value => {
                  const option = possibleOptions.find(
                    (opt: any) => opt.value === value
                  );
                  return option ? option.label : value;
                });
                return selectedLabels.join(', ');
              }}
            >
              {possibleOptions.map((opt: any) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={selectedValues.indexOf(opt.value) > -1} />
                  <ListItemText primary={opt.label} />
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
              data-testid="value-input"
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
              data-testid="value-input"
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
              data-testid="value-input"
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
      // turns the single condition into an AND group with a duplicate,
      props.onChange({
        operator: 'and',
        conditions: [condition, JSON.parse(JSON.stringify(condition))],
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
          getOptionLabel={(fieldId: string) =>
            getFieldLabel(allFields[fieldId]) ?? ''
          }
          value={condition.field || null}
          onChange={(_, newValue) => {
            updateField(newValue || '');
          }}
          data-testid="field-input"
          renderInput={params => (
            <TextField {...params} label="Field" variant="outlined" />
          )}
          style={{minWidth: 200}}
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
          <TextField label="Value" sx={{minWidth: 200}} onChange={() => {}} />
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
