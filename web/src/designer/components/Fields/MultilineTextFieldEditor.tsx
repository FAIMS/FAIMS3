import {FormHelperText, TextField} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

export const MultilineTextFieldEditor = ({fieldName}: {fieldName: string}) => {
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

  const rows = (field['component-parameters'].rows as number) ?? 4;

  const handleRowsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const value = event.target.value;

    if (value === '') {
      newField['component-parameters'].rows = 4; // Reset to default
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        newField['component-parameters'].rows = parsed;
      }
    }

    updateField(fieldName, newField);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <TextField
        label="Number of Rows"
        type="number"
        value={rows}
        onChange={handleRowsChange}
        variant="outlined"
        size="small"
        inputProps={{min: 1, max: 20}}
        sx={{width: 150}}
      />
      <FormHelperText>
        Set the minimum number of visible text rows (1-20). Default is 4.
      </FormHelperText>
    </BaseFieldEditor>
  );
};
