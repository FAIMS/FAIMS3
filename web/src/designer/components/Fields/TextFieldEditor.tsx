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
// import SpeechSettingsEditor from '../modules/SpeechSettingsEditor';
import {BaseFieldEditor} from './BaseFieldEditor';

export const TextFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const initVal = field['initialValue'] as string | number;
  const subType = field['component-parameters'].InputProps?.type || '';

  const updateDefault = (value: string | number | null) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['initialValue'] = value;
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      {/* config option to add a default value for plain text fields */}
      {subType === 'string' && (
        <Grid item xs={6}>
          <Card variant="outlined" sx={{display: 'flex'}}>
            <Grid item xs={12} sx={{mx: 1.5, my: 2}}>
              <DebouncedTextField
                name="pre-populated"
                variant="outlined"
                label="Default Text"
                value={initVal}
                helperText="Choose this field's default text."
                onChange={e => {
                  updateDefault(e.target.value);
                }}
              />
            </Grid>
          </Card>
        </Grid>
      )}

      {/* config option to add a default value for number fields */}
      {subType === 'number' && (
        <Grid item xs={12} sm={6}>
          <Card variant="outlined" sx={{display: 'flex'}}>
            <Grid item xs={12} sx={{mx: 1.5, my: 2}}>
              <DebouncedTextField
                name="pre-populated"
                variant="outlined"
                label="Default Number"
                type="number"
                value={typeof initVal === 'number' ? initVal : ''}
                helperText="Set a default value for this number field."
                onChange={e => {
                  const value =
                    e.target.value.trim() === ''
                      ? null
                      : Number(e.target.value);
                  updateDefault(value);
                }}
              />
            </Grid>
          </Card>
        </Grid>
      )}

      {/* Speech-to-text settings - only show for string/text fields */}
      {//subType === 'string' && <SpeechSettingsEditor fieldName={fieldName} />
      }
    </BaseFieldEditor>
  );
};
