import {Box, FormHelperText, TextField} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

export const ControlledNumberFieldEditor = ({
  fieldName,
}: {
  fieldName: string;
}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const min = field['component-parameters'].min as number | undefined;
  const max = field['component-parameters'].max as number | undefined;

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const value = event.target.value;

    if (value === '') {
      delete newField['component-parameters'].min;
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        newField['component-parameters'].min = parsed;
      }
    }

    updateField(fieldName, newField);
  };

  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const value = event.target.value;

    if (value === '') {
      delete newField['component-parameters'].max;
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        newField['component-parameters'].max = parsed;
      }
    }

    updateField(fieldName, newField);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{display: 'flex', gap: 2, mb: 1}}>
        <TextField
          label="Minimum Value"
          type="number"
          value={min ?? ''}
          onChange={handleMinChange}
          variant="outlined"
          size="small"
          sx={{flex: 1}}
        />
        <TextField
          label="Maximum Value"
          type="number"
          value={max ?? ''}
          onChange={handleMaxChange}
          variant="outlined"
          size="small"
          sx={{flex: 1}}
        />
      </Box>
      <FormHelperText>
        Set minimum and/or maximum allowed values. Leave empty for no limit.
      </FormHelperText>
    </BaseFieldEditor>
  );
};
