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
import InfoIcon from '@mui/icons-material/Info';
import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {designerInfoIconSx} from '../designer-style';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

type FieldState = {
  featureType: string;
  zoom: number;
  allowSetToCurrentPoint: boolean;
  buttonLabelText: string;
};

/** Map geometry type, zoom, GeoTIFF path, and “use current location” toggle for `MapFormField`. */
export const MapFormFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const initZoom = field['component-parameters'].zoom;
  const initFeatureType = field['component-parameters'].featureType;
  const initAllowSetToCurrentPoint =
    field['component-parameters'].allowSetToCurrentPoint ?? false;
  const initButtonLabelText =
    field['component-parameters'].buttonLabelText ?? '';

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch(fieldUpdated({fieldName, newField}));
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
      <Box sx={{width: '100%', mt: 1.5}}>
        <Stack spacing={2}>
          <SimpleFieldWrapper heading="Feature Type">
            <TextField
              select
              fullWidth
              label=""
              value={initFeatureType}
              onChange={e => updateProperty('featureType', e.target.value)}
              required
            >
              <MenuItem value="Polygon">Polygon</MenuItem>
              <MenuItem value="Point">Point</MenuItem>
              <MenuItem value="LineString">LineString</MenuItem>
            </TextField>
          </SimpleFieldWrapper>

          <SimpleFieldWrapper heading="Zoom Level">
            <DebouncedTextField
              fullWidth
              variant="outlined"
              label=""
              type="number"
              value={initZoom}
              slotProps={{htmlInput: {min: 0}}}
              onChange={e => updateProperty('zoom', parseFloat(e.target.value))}
            />
          </SimpleFieldWrapper>

          <SimpleFieldWrapper
            heading="Button Label Text"
            helperText="Custom text for the location button. If empty, the field label will be used."
          >
            <DebouncedTextField
              fullWidth
              variant="outlined"
              label=""
              value={initButtonLabelText}
              placeholder="Leave empty to use the field label"
              onChange={e => updateProperty('buttonLabelText', e.target.value)}
            />
          </SimpleFieldWrapper>

          {initFeatureType === 'Point' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={initAllowSetToCurrentPoint}
                  onChange={e =>
                    updateProperty('allowSetToCurrentPoint', e.target.checked)
                  }
                />
              }
              label={
                <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  Display set to current location button
                  <Tooltip title="Enabling this option allows users to directly set their current location as the selected location.">
                    <InfoIcon sx={designerInfoIconSx} />
                  </Tooltip>
                </span>
              }
            />
          )}
        </Stack>
      </Box>
    </BaseFieldEditor>
  );
};
