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
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Tooltip,
  Grid,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';

/**
 * HiddenFieldEditor is a component for managing whether a field should be
 * hidden in the form. It provides a simple checkbox interface with an
 * explanation tooltip.
 *
 * Toggles the component ['component-parameters'].ElementProps.hidden
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} props.fieldName - Name of the field being edited
 */

export const HiddenFieldEditor = ({fieldName}: {fieldName: string}) => {
  // Get field state from Redux store
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const dispatch = useAppDispatch();

  // Get current hidden state, defaulting to false if not set
  const isHidden = field['component-parameters'].hidden ?? false;

  /**
   * Updates the hidden state in Redux store
   * @param {boolean} newValue - New hidden state value
   */
  const updateHiddenState = (newValue: boolean) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    // Ensure ElementProps exists and update hidden property
    newField['component-parameters'] = {
      ...newField['component-parameters'],
      hidden: newValue,
    };
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  return (
    <Grid container>
      <Paper sx={{width: '100%', mt: 2, p: 3}}>
        <Box>
          {/* Info alert explaining the feature */}
          <Alert
            severity="info"
            sx={{
              mb: 2,
              backgroundColor: 'rgb(229, 246, 253)',
              '& .MuiAlert-icon': {
                color: 'rgb(1, 67, 97)',
              },
            }}
          >
            Control whether this field is hidden in the form. Hidden fields can
            still be used in TemplatedString fields, and are available in
            exported data, but won't be visible to users.
          </Alert>
          {/* Hidden toggle checkbox with tooltip */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isHidden}
                onChange={e => updateHiddenState(e.target.checked)}
                size="small"
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Hide this field in the form</span>
                <Tooltip title="When hidden, this field won't be visible in the form interface but can still be used for calculations, conditions, or other background operations.">
                  <InfoIcon color="action" fontSize="small" />
                </Tooltip>
              </Stack>
            }
          />
        </Box>
      </Paper>
    </Grid>
  );
};

export default HiddenFieldEditor;
