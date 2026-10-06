// SPDX-License-Identifier: Apache-2.0

import {Box, FormHelperText, TextField} from '@mui/material';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';

/** Min, max, and step for `PercentageSlider` fields (0–100 scale). */
export const PercentageSliderFieldEditor = ({
  fieldName,
}: {
  fieldName: string;
}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();
  const componentParameters = field['component-parameters'] as Record<
    string,
    unknown
  >;

  const min = componentParameters.min as number | undefined;
  const max = componentParameters.max as number | undefined;
  const step = componentParameters.step as number | undefined;

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = withUpdatedField(field, nextField => {
      const value = event.target.value;
      if (value === '') {
        delete nextField['component-parameters'].min;
      } else {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          nextField['component-parameters'].min = Math.min(
            100,
            Math.max(0, parsed)
          );
        }
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = withUpdatedField(field, nextField => {
      const value = event.target.value;
      if (value === '') {
        delete nextField['component-parameters'].max;
      } else {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          nextField['component-parameters'].max = Math.min(
            100,
            Math.max(0, parsed)
          );
        }
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const handleStepChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = withUpdatedField(field, nextField => {
      const value = event.target.value;
      if (value === '') {
        delete (nextField['component-parameters'] as Record<string, unknown>)
          .step;
      } else {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed > 0) {
          (nextField['component-parameters'] as Record<string, unknown>).step =
            Math.min(100, parsed);
        }
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1}}>
        <TextField
          label="Minimum (%)"
          type="number"
          value={min ?? ''}
          onChange={handleMinChange}
          variant="outlined"
          size="small"
          slotProps={{htmlInput: {min: 0, max: 100}}}
          sx={{flex: '1 1 120px'}}
        />
        <TextField
          label="Maximum (%)"
          type="number"
          value={max ?? ''}
          onChange={handleMaxChange}
          variant="outlined"
          size="small"
          slotProps={{htmlInput: {min: 0, max: 100}}}
          sx={{flex: '1 1 120px'}}
        />
        <TextField
          label="Step"
          type="number"
          value={step ?? ''}
          onChange={handleStepChange}
          variant="outlined"
          size="small"
          slotProps={{htmlInput: {min: 1, max: 100}}}
          sx={{flex: '1 1 120px'}}
        />
      </Box>
      <FormHelperText>
        Values are integers from 0–100. Minimum must not exceed maximum. Step
        must fit within the range (defaults: min 0, max 100, step 1).
      </FormHelperText>
    </BaseFieldEditor>
  );
};
