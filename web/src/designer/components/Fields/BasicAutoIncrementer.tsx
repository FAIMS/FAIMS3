import {Typography} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import DebouncedTextField from '../debounced-text-field';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

type PropType = {
  fieldName: string;
  viewId: string;
};

/** Digit width for auto-increment (scoped to `viewId` via reducer when field is created). */
export const BasicAutoIncrementerEditor = ({fieldName, viewId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
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
      <SimpleFieldWrapper
        heading="Number of digits in identifier"
        helperText="Identifier will be padded with zeros up to this many digits."
      >
        <DebouncedTextField
          name="digits"
          variant="outlined"
          label=""
          type="number"
          value={digits}
          onChange={e => updateDigits(parseInt(e.target.value))}
        />
      </SimpleFieldWrapper>
    </BaseFieldEditor>
  );
};
