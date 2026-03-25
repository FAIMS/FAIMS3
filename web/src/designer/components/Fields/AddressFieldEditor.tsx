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

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Card,
  Checkbox,
  FormControlLabel,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';
import {fieldUpdated} from '../../store/slices/uiSpec';

type AddressFieldConfig = {
  enableAutoSuggestion: boolean;
  allowFullAddressManualEntry: boolean;
};

/** Address plugin toggles: online suggestions vs full manual structured entry. */
export const AddressFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const params = field['component-parameters'];
  const state: AddressFieldConfig = {
    enableAutoSuggestion: params.enableAutoSuggestion ?? true,
    allowFullAddressManualEntry: params.allowFullAddressManualEntry ?? false,
  };

  const updateField = (newState: AddressFieldConfig) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['component-parameters'].enableAutoSuggestion =
      newState.enableAutoSuggestion;
    newField['component-parameters'].allowFullAddressManualEntry =
      newState.allowFullAddressManualEntry;
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const updateProperty = (prop: keyof AddressFieldConfig, value: boolean) => {
    updateField({...state, [prop]: value});
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item xs={12}>
        <Card variant="outlined" sx={{display: 'flex'}}>
          <Grid container p={2} rowGap={1}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.enableAutoSuggestion}
                    onChange={e =>
                      updateProperty('enableAutoSuggestion', e.target.checked)
                    }
                  />
                }
                label={
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <Typography variant="body2">
                      Enable online address autosuggestion
                    </Typography>
                    <Tooltip title="When enabled and the app injects an autosuggest provider (e.g. Mapbox), the field will show a search UI. When disabled, the field always uses manual entry.">
                      <HelpOutlineIcon
                        fontSize="small"
                        sx={{color: 'action.active', cursor: 'help'}}
                      />
                    </Tooltip>
                  </span>
                }
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.allowFullAddressManualEntry}
                    onChange={e =>
                      updateProperty(
                        'allowFullAddressManualEntry',
                        e.target.checked
                      )
                    }
                  />
                }
                label={
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <Typography variant="body2">
                      Allow structured manual entry when autosuggest is
                      unavailable
                    </Typography>
                    <Tooltip title="When offline or autosuggest is disabled/unavailable, allow users to enter the address by parts (street, suburb, state, etc.) instead of a single free-text address string.">
                      <HelpOutlineIcon
                        fontSize="small"
                        sx={{color: 'action.active', cursor: 'help'}}
                      />
                    </Tooltip>
                  </span>
                }
              />
            </Grid>
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
