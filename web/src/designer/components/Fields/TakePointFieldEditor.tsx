/**
 * TakePointFieldEditor
 *
 * This editor exists because TakePoint needs a custom "Button Label Text" field
 * that isn't part of BaseFieldEditor. Without this, TakePoint would just fall
 * through to BaseFieldEditor which only provides Label, Field ID, Helper Text, etc.
 */

import {Grid} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import DebouncedTextField from '../debounced-text-field';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {BaseFieldEditor} from './BaseFieldEditor';

export const TakePointFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const buttonLabelText = field['component-parameters'].buttonLabelText ?? '';

  const updateButtonLabel = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      if (value.trim()) {
        nextField['component-parameters'].buttonLabelText = value;
      } else {
        delete nextField['component-parameters'].buttonLabelText;
      }
    });
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid container>
        <Grid item sm={6} xs={12}>
          <DebouncedTextField
            variant="outlined"
            label="Button Label Text"
            value={buttonLabelText}
            placeholder="Leave empty to use the field label"
            onChange={e => updateButtonLabel(e.target.value)}
            helperText="Custom text for the button. If empty, the field label will be used."
          />
        </Grid>
      </Grid>
    </BaseFieldEditor>
  );
};
