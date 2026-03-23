import {Typography} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import DebouncedTextField from '../debounced-text-field';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
};

export const BasicAutoIncrementerEditor = ({fieldName, viewId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const digits = field['component-parameters'].num_digits || 4;

  const updateDigits = (value: number) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].form_id = viewId;
      nextField['component-parameters'].num_digits = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <BaseFieldEditor
      fieldName={fieldName}
      showExtraConfig={false}
      showHelperText={false}
    >
      <Typography variant="body1" sx={{mb: 1}}>
        This field provides a counter value that increments with each new
        record. Users select a range of values for the counter on their device.
        Often used as part of a Templated String Field.
      </Typography>
      <DebouncedTextField
        name="digits"
        variant="outlined"
        label="Number of digits in identifier"
        type="number"
        value={digits}
        helperText="Identifier will be padded with zeros up to this many digits."
        onChange={e => updateDigits(parseInt(e.target.value))}
      />
    </BaseFieldEditor>
  );
};
