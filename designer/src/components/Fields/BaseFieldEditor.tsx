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

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Card,
  Checkbox,
  FormControlLabel,
  Grid,
  Tooltip,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {
  ConditionModal,
  ConditionTranslation,
  ConditionType,
} from '../condition';

import {VITE_TEMPLATE_PROTECTIONS} from '../../buildconfig';
import DebouncedTextField from '../debounced-text-field';

type Props = {
  fieldName: string;
  children?: React.ReactNode;
};

type StateType = {
  label?: string;
  helperText: string;
  required: boolean;
  persistent: boolean;
  displayParent: boolean;
  annotation: boolean;
  annotationLabel: string;
  uncertainty: boolean;
  uncertaintyLabel: string;
  condition?: ConditionType | null;
  protection: boolean;
  allowHiding: boolean;
};

export const BaseFieldEditor = ({fieldName, children}: Props) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const dispatch = useAppDispatch();

  // Derive the field label from possible alternatives
  const getFieldLabel = () => {
    return (
      field['component-parameters']?.label ?? field['component-parameters'].name
    );
  };

  const setFieldLabel = (newField: FieldType, label: string) => {
    newField['component-parameters'].label = label;
  };

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const cParams = field['component-parameters'];

  const protectionSetting = cParams.protection || 'none';
  const protectionEnabled = protectionSetting !== 'none';
  const allowHidingEnabled = protectionSetting === 'allow-hiding';

  const state: StateType = {
    label: getFieldLabel(),
    helperText: cParams.helperText || '',
    required: cParams.required || false,
    annotation: field.meta?.annotation?.include || false,
    annotationLabel: field.meta?.annotation?.label || '',
    uncertainty: field.meta?.uncertainty?.include || false,
    uncertaintyLabel: field.meta?.uncertainty?.label || '',
    condition: field.condition,
    persistent: field.persistent || false,
    displayParent: field.displayParent || false,
    protection: protectionEnabled,
    allowHiding: allowHidingEnabled,
  };

  const updateFieldFromState = (newState: StateType) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy

    if (newState.label !== undefined) {
      setFieldLabel(newField, newState.label);
    }

    newField['component-parameters'].helperText = newState.helperText;
    newField['component-parameters'].required = newState.required;

    if (newField.meta) {
      newField.meta.annotation = {
        include: newState.annotation,
        label: newState.annotationLabel || '',
      };
      newField.meta.uncertainty = {
        include: newState.uncertainty,
        label: newState.uncertaintyLabel || '',
      };
    }

    if (newState.protection) {
      newField['component-parameters'].protection = newState.allowHiding
        ? 'allow-hiding'
        : 'protected';
    } else {
      newField['component-parameters'].protection = 'none';
    }

    newField.condition = newState.condition || null;
    newField.persistent = newState.persistent || false;
    newField.displayParent = newState.displayParent || false;

    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string | boolean) => {
    const newState: StateType = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  const conditionChanged = (condition: ConditionType | null) => {
    const newState: StateType = {...state, condition};
    updateFieldFromState(newState);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Card variant="outlined" sx={{p: 2}}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <DebouncedTextField
                fullWidth
                label="Label"
                value={state.label}
                onChange={e => updateProperty('label', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <DebouncedTextField
                fullWidth
                label="Helper Text"
                value={state.helperText}
                multiline
                rows={2}
                onChange={e => updateProperty('helperText', e.target.value)}
              />
            </Grid>
            {children && (
              <Grid item xs={12}>
                {children}
              </Grid>
            )}
          </Grid>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card variant="outlined" sx={{p: 2}}>
          <Grid container spacing={2}>
            {/* Row 1: Required, Annotation, Uncertainty, Condition */}
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.required}
                    onChange={e => updateProperty('required', e.target.checked)}
                  />
                }
                label="Required"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.annotation}
                    onChange={e =>
                      updateProperty('annotation', e.target.checked)
                    }
                  />
                }
                label="Annotation"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.uncertainty}
                    onChange={e =>
                      updateProperty('uncertainty', e.target.checked)
                    }
                  />
                }
                label="Uncertainty"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <ConditionModal
                label={state.condition ? 'Update Condition' : 'Add Condition'}
                initial={state.condition}
                onChange={conditionChanged}
                field={fieldName}
              />
            </Grid>

            {/* Row 2: Annotation and Uncertainty Labels */}
            <Grid item container spacing={2}>
              <Grid item xs={12} md={6}>
                {state.annotation ? (
                  <DebouncedTextField
                    fullWidth
                    label="Annotation Label"
                    value={state.annotationLabel}
                    onChange={e =>
                      updateProperty('annotationLabel', e.target.value)
                    }
                  />
                ) : (
                  <div />
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                {state.uncertainty ? (
                  <DebouncedTextField
                    fullWidth
                    label="Uncertainty Label"
                    value={state.uncertaintyLabel}
                    onChange={e =>
                      updateProperty('uncertaintyLabel', e.target.value)
                    }
                  />
                ) : (
                  <div />
                )}
              </Grid>
            </Grid>

            {/* Row 3: Condition Alert */}
            <Grid item xs={12}>
              {state.condition && (
                <Alert severity="info">
                  <strong>Field Condition:</strong> Show this field if&nbsp;
                  <ConditionTranslation condition={state.condition} />
                </Alert>
              )}
            </Grid>

            {/* Row 4: Persistent, Display Parent, Protection, Allow Hiding */}
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.persistent}
                    onChange={e =>
                      updateProperty('persistent', e.target.checked)
                    }
                  />
                }
                label="Copy value to new records"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.displayParent}
                    onChange={e =>
                      updateProperty('displayParent', e.target.checked)
                    }
                  />
                }
                label="Display in parent record"
              />
            </Grid>
            {VITE_TEMPLATE_PROTECTIONS && (
              <>
                <Grid item xs={12} sm={3}>
                  <div style={{display: 'flex', alignItems: 'center'}}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={state.protection}
                          onChange={e =>
                            updateProperty('protection', e.target.checked)
                          }
                        />
                      }
                      label="Protected Field"
                    />
                    <Tooltip title="Enable protection to prevent users of this template (or derived templates) from editing or deleting this field.">
                      <InfoOutlinedIcon
                        fontSize="small"
                        style={{marginLeft: 0, color: '#757575'}}
                      />
                    </Tooltip>
                  </div>
                </Grid>
                <Grid item xs={12} sm={3}>
                  {state.protection ? (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={state.allowHiding}
                          onChange={e =>
                            updateProperty('allowHiding', e.target.checked)
                          }
                        />
                      }
                      label="Allow Hiding"
                    />
                  ) : (
                    <div />
                  )}
                </Grid>
              </>
            )}
          </Grid>
        </Card>
      </Grid>
    </Grid>
  );
};
