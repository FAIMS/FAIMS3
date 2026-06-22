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
import {MapFieldProps} from '@faims3/forms';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {designerInfoIconSx} from '../designer-style';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';
import {useTextFieldLengthLimit} from '@/hooks/use-input-char-limit';

// Max allowable num of characters for the map action button
const MAX_NUM_CHARACTERS_BUTTON_LENGTH = 40;

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

  const params = field['component-parameters'] as unknown as MapFieldProps;
  const initZoom = params.zoom;
  const initFeatureType = params.featureType;
  const initAllowSetToCurrentPoint = params.allowSetToCurrentPoint ?? false;
  const initButtonLabelText = params.buttonLabelText ?? '';

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const state: FieldState = {
    featureType: params.featureType || '',
    zoom: params.zoom || 0,
    allowSetToCurrentPoint: params.allowSetToCurrentPoint ?? false,
    buttonLabelText: params.buttonLabelText ?? '',
  };

  const updateFieldFromState = (newState: FieldState) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
    const newParams = newField[
      'component-parameters'
    ] as unknown as MapFieldProps;
    newParams.featureType =
      newState.featureType as MapFieldProps['featureType'];
    newParams.zoom = newState.zoom;
    // Only set allowSetToCurrentPoint for Point type, otherwise ensure it's false
    newParams.allowSetToCurrentPoint =
      newState.featureType === 'Point'
        ? newState.allowSetToCurrentPoint
        : false;
    // Store buttonLabelText, or remove if empty
    if (newState.buttonLabelText.trim()) {
      newParams.buttonLabelText = newState.buttonLabelText;
    } else {
      delete newParams.buttonLabelText;
    }
    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string | number | boolean) => {
    const newState = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  const {
    errorText: buttonLabelErrorTxt,
    inputValue: buttonLabelValue,
    validateAndUpdate: validateAndUpdateButtonLabelText,
  } = useTextFieldLengthLimit({
    maxLength: MAX_NUM_CHARACTERS_BUTTON_LENGTH,
    initialValue: initButtonLabelText,
  });

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
              value={buttonLabelValue}
              error={!!buttonLabelErrorTxt}
              helperText={buttonLabelErrorTxt}
              placeholder="Leave empty to use the field label"
              onChange={e =>
                validateAndUpdateButtonLabelText(e.target.value, validValue =>
                  updateProperty('buttonLabelText', validValue)
                )
              }
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
