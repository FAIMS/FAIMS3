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
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {useAppSelector, useAppDispatch} from '../../state/hooks';
import {BaseFieldEditor} from './BaseFieldEditor';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {designerInfoIconSx} from '../designer-style';

/** Shared date-time editor: auto-pick current time and optional "Now" button display. */
export const DateTimeNowEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();
  const fieldComponent = field['component-name'];
  const isDateTimePicker = fieldComponent === 'DateTimePicker';
  const isDatePicker = fieldComponent === 'DatePicker';
  const isMonthPicker = fieldComponent === 'MonthPicker';
  const supportsAutoPick = fieldComponent !== 'DatePicker';
  const supportsNowButton = isDateTimePicker || isDatePicker || isMonthPicker;

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
              {supportsAutoPick && (
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
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography component="span">Time pre-populated</Typography>
                      <Tooltip title="When the record is first created, populate this field with the current datetime.">
                        <InfoIcon
                          sx={{
                            ...(designerInfoIconSx as Record<string, unknown>),
                          }}
                        />
                      </Tooltip>
                    </Stack>
                  }
                />
              )}
              {supportsNowButton && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showNowButton}
                      onChange={e => {
                        updateFieldProp('show_now_button', e.target.checked);
                      }}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography component="span">
                        Display a "
                        <strong>
                          {isDatePicker
                            ? "Select today's date"
                            : isMonthPicker
                            ? 'Select current month'
                            : 'Select date and time right now'}
                        </strong>
                        " button
                      </Typography>
                      <Tooltip
                        title={
                          isDatePicker
                            ? 'Adds a quick button to set this field to today’s date.'
                            : isMonthPicker
                            ? 'Adds a quick button to set this field to the current month.'
                            : 'Adds a quick button to set this field to the current date and time.'
                        }
                      >
                        <InfoIcon
                          sx={{
                            ...(designerInfoIconSx as Record<string, unknown>),
                          }}
                        />
                      </Tooltip>
                    </Stack>
                  }
                />
              )}
            </Stack>
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
