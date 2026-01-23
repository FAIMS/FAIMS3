/**
 * TakePointFieldEditor
 *
 * This editor exists because TakePoint needs a custom "Button Label Text" field
 * that isn't part of BaseFieldEditor. Without this, TakePoint would just fall
 * through to BaseFieldEditor which only provides Label, Field ID, Helper Text, etc.
 */

import {Grid} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';

export const TakePointFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const buttonLabelText = field['component-parameters'].buttonLabelText ?? '';

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const updateButtonLabel = (value: string) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    if (value.trim()) {
      newField['component-parameters'].buttonLabelText = value;
    } else {
      delete newField['component-parameters'].buttonLabelText;
    }
    updateField(fieldName, newField);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid container>
        <Grid item sm={6} xs={12}>
          <DebouncedTextField
            variant="outlined"
            label="Button Label Text"
            value={buttonLabelText}
            placeholder="Leave empty to use field label"
            onChange={e => updateButtonLabel(e.target.value)}
            helperText="Custom text for the button. If empty, the field label will be used."
          />
        </Grid>
      </Grid>
    </BaseFieldEditor>
  );
};
