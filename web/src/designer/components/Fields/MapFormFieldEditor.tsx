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
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';

type FieldState = {
  featureType: string;
  zoom: number;
  allowSetToCurrentPoint: boolean;
  buttonLabelText: string;
};

export const MapFormFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const initZoom = field['component-parameters'].zoom;
  const initFeatureType = field['component-parameters'].featureType;
  const initAllowSetToCurrentPoint =
    field['component-parameters'].allowSetToCurrentPoint ?? false;
  const initButtonLabelText =
    field['component-parameters'].buttonLabelText ?? '';

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const state: FieldState = {
    featureType: field['component-parameters'].featureType || '',
    zoom: field['component-parameters'].zoom || 0,
    allowSetToCurrentPoint:
      field['component-parameters'].allowSetToCurrentPoint ?? false,
    buttonLabelText: field['component-parameters'].buttonLabelText ?? '',
  };

  const updateFieldFromState = (newState: FieldState) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
    newField['component-parameters'].featureType = newState.featureType;
    newField['component-parameters'].zoom = newState.zoom;
    // Only set allowSetToCurrentPoint for Point type, otherwise ensure it's false
    newField['component-parameters'].allowSetToCurrentPoint =
      newState.featureType === 'Point'
        ? newState.allowSetToCurrentPoint
        : false;
    // Store buttonLabelText, or remove if empty
    if (newState.buttonLabelText.trim()) {
      newField['component-parameters'].buttonLabelText =
        newState.buttonLabelText;
    } else {
      delete newField['component-parameters'].buttonLabelText;
    }
    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string | number | boolean) => {
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
                label="Zoom Level"
                type="number"
                value={initZoom}
                inputProps={{min: 0}}
                onChange={e =>
                  updateProperty('zoom', parseFloat(e.target.value))
                }
              />
            </Grid>
            <Grid item sm={6} xs={12}>
              <FormControl sx={{minWidth: 150}}>
                <InputLabel id="featureType-label">
                  Select Feature Type
                </InputLabel>
                <Select
                  labelId="featureType-label"
                  label="Select Feature Type"
                  value={initFeatureType}
                  onChange={e => updateProperty('featureType', e.target.value)}
                  required
                >
                  <MenuItem value="Polygon">Polygon</MenuItem>
                  <MenuItem value="Point">Point</MenuItem>
                  <MenuItem value="LineString">LineString</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item sm={6} xs={12}>
              <DebouncedTextField
                variant="outlined"
                label="Button Label Text"
                value={initButtonLabelText}
                placeholder="Leave empty to use field label"
                onChange={e =>
                  updateProperty('buttonLabelText', e.target.value)
                }
                helperText="Custom text for the location button. If empty, the field label will be used."
              />
            </Grid>
            {initFeatureType === 'Point' && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={initAllowSetToCurrentPoint}
                      onChange={e =>
                        updateProperty(
                          'allowSetToCurrentPoint',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={
                    <span
                      style={{display: 'flex', alignItems: 'center', gap: 4}}
                    >
                      Display set to current point button
                      <Tooltip title="Enabling this option allows users to directly set their current location as the selected point.">
                        <HelpOutlineIcon
                          fontSize="small"
                          sx={{color: 'action.active', cursor: 'help'}}
                        />
                      </Tooltip>
                    </span>
                  }
                />
              </Grid>
            )}
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
