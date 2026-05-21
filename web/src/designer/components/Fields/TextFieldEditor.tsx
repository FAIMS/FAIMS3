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
  Box,
  Card,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import DebouncedTextField from '../debounced-text-field';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

/** Inspector for single-line text fields (initial value, HTML input type, wraps {@link BaseFieldEditor}). */
export const TextFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const initVal = field['initialValue'] as string | number;
  // Long answer = either the unified shape (TextField / legacy FAIMSTextField
  // with `multiline: true`) or the un-migrated legacy `MultipleTextField`
  // (where multiline was implicit). Treat all of those as long.
  const isLongAnswer =
    field['component-parameters'].multiline === true ||
    field['component-name'] === 'MultipleTextField';
  const rows =
    (field['component-parameters'].rows as number | undefined) ||
    field['component-parameters'].InputProps?.rows ||
    4;

  const updateField = (updater: (nextField: typeof field) => void) => {
    const newField = withUpdatedField(field, nextField => {
      updater(nextField);
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const updateDefault = (value: string | number | null) => {
    updateField(nextField => {
      nextField['initialValue'] = value;
    });
  };

  // Short and long answer share one runtime component (canonical `TextField`).
  // Toggling just flips the `multiline` flag (and `rows` when long), and also
  // promotes any legacy `FAIMSTextField` / `MultipleTextField` field onto the
  // canonical name in the same write so subsequent edits stay on the new shape.
  const setAnswerMode = (mode: 'short' | 'long') => {
    updateField(nextField => {
      const params = nextField['component-parameters'];
      nextField['component-name'] = 'TextField';
      nextField['component-namespace'] = 'faims-custom';
      if (mode === 'short') {
        delete params.multiline;
        delete params.rows;
        delete params.InputProps;
      } else {
        params.multiline = true;
        params.rows = (params.rows as number | undefined) ?? rows ?? 4;
        // Drop the legacy nested InputProps if it was carried over from
        // an un-migrated MultipleTextField field.
        delete params.InputProps;
      }
    });
  };

  const updateRows = (value: number) => {
    const safeRows = Number.isFinite(value) && value > 0 ? value : 1;
    updateField(nextField => {
      // Always promote to the unified shape before writing — otherwise editing
      // an un-migrated MultipleTextField would orphan the rows value (the legacy
      // runtime reads InputProps.rows, the new one reads top-level rows).
      nextField['component-name'] = 'TextField';
      nextField['component-namespace'] = 'faims-custom';
      const params = nextField['component-parameters'];
      params.multiline = true;
      params.rows = safeRows;
      delete params.InputProps;
    });
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item xs={12} md={8}>
        <Card variant="outlined">
          <Box sx={{px: 2, py: 2}}>
            <FormControl>
              <RadioGroup
                row
                value={isLongAnswer ? 'long' : 'short'}
                onChange={e => setAnswerMode(e.target.value as 'short' | 'long')}
              >
                <FormControlLabel
                  value="short"
                  control={<Radio />}
                  label="Short answer"
                />
                <FormControlLabel
                  value="long"
                  control={<Radio />}
                  label="Long answer"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </Card>
      </Grid>

      {isLongAnswer && (
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <Box sx={{px: 2, py: 2}}>
              <SimpleFieldWrapper
                heading="Rows to display"
                helperText="Number of rows in the text field."
              >
                <DebouncedTextField
                  name="rows"
                  variant="outlined"
                  label=""
                  type="number"
                  value={rows}
                  onChange={e => updateRows(parseInt(e.target.value))}
                />
              </SimpleFieldWrapper>
            </Box>
          </Card>
        </Grid>
      )}

      <Grid item xs={12} md={isLongAnswer ? 6 : 12}>
        <Card variant="outlined">
          <Box sx={{px: 2, py: 2}}>
            <SimpleFieldWrapper
              heading="Default Text"
              helperText="Choose this field's default text."
            >
              <DebouncedTextField
                name="pre-populated"
                variant="outlined"
                label=""
                value={initVal}
                onChange={e => {
                  updateDefault(e.target.value);
                }}
              />
            </SimpleFieldWrapper>
          </Box>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
