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
import {Card, Grid} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';

type FieldState = {
  buttonLabelText: string;
};

export const TakePointFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const initButtonLabelText =
    field['component-parameters'].buttonLabelText ?? '';

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const state: FieldState = {
    buttonLabelText: field['component-parameters'].buttonLabelText ?? '',
  };

  const updateFieldFromState = (newState: FieldState) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
    // Store buttonLabelText, or remove if empty
    if (newState.buttonLabelText.trim()) {
      newField['component-parameters'].buttonLabelText =
        newState.buttonLabelText;
    } else {
      delete newField['component-parameters'].buttonLabelText;
    }
    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string) => {
    const newState = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item xs={12}>
        <Card variant="outlined" sx={{display: 'flex'}}>
          <Grid container p={2} rowGap={2}>
            <Grid item sm={6} xs={12}>
              <DebouncedTextField
                variant="outlined"
                label="Button Label Text"
                value={initButtonLabelText}
                placeholder="Leave empty to use field label"
                onChange={e =>
                  updateProperty('buttonLabelText', e.target.value)
                }
                helperText="Custom text for the button. If empty, the field label will be used."
              />
            </Grid>
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
