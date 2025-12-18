import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

export const NumberFieldEditor = ({fieldName}: {fieldName: string}) => {
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

  const numberType =
    (field['component-parameters'].numberType as 'integer' | 'floating') ||
    'integer';

  const handleNumberTypeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['component-parameters'].numberType = event.target.value as
      | 'integer'
      | 'floating';
    updateField(fieldName, newField);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <FormControl component="fieldset">
        <FormLabel component="legend">Number Type</FormLabel>
        <RadioGroup
          row
          value={numberType}
          onChange={handleNumberTypeChange}
          name="number-type-radio-group"
        >
          <FormControlLabel
            value="integer"
            control={<Radio />}
            label="Integer"
          />
          <FormControlLabel
            value="floating"
            control={<Radio />}
            label="Decimal"
          />
        </RadioGroup>
        <FormHelperText>
          Integer shows stepper controls and accepts whole numbers only. Decimal
          allows fractional values.
        </FormHelperText>
      </FormControl>
    </BaseFieldEditor>
  );
};
