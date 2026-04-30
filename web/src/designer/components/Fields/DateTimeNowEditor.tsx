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
  Card,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Grid,
  Stack,
} from '@mui/material';
import {useAppSelector, useAppDispatch} from '../../state/hooks';
import {BaseFieldEditor} from './BaseFieldEditor';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';

/** Shared date-time editor: auto-pick current time and optional "Now" button display. */
export const DateTimeNowEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();
  const isDateTimePicker = field['component-name'] === 'DateTimePicker';

  const updateFieldProp = (key: 'is_auto_pick' | 'show_now_button', value: boolean) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'][key] = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const isAutoPick = field['component-parameters'].is_auto_pick ?? false;
  const showNowButton = field['component-parameters'].show_now_button ?? false;

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item sm={8} xs={12}>
        <Card variant="outlined" sx={{display: 'flex'}}>
          <Grid item xs={12} sx={{mx: 1.5, my: 2}}>
            <Stack spacing={1}>
              <FormControlLabel
                required
                control={
                  <Checkbox
                    checked={isAutoPick}
                    onChange={e => {
                      updateFieldProp('is_auto_pick', e.target.checked);
                    }}
                  />
                }
                label="Time pre-populated"
              />
              <FormHelperText sx={{mt: -1}}>
                When the record is first created, populate this field with the
                current datetime.
              </FormHelperText>
              {isDateTimePicker && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showNowButton}
                      onChange={e => {
                        updateFieldProp('show_now_button', e.target.checked);
                      }}
                    />
                  }
                  label='Display a "Select date and time right now" button'
                />
              )}
            </Stack>
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
