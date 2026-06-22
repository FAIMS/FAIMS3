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
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';
import {useTextFieldLengthLimit} from '@/hooks/use-input-char-limit';
import {TakePointFieldProps} from '@faims3/forms';

// Max allowable num of characters for the map action button
const MAX_NUM_CHARACTERS_BUTTON_LENGTH = 40;

/**
 * GPS capture field: custom “button label” plus standard {@link BaseFieldEditor} props.
 */
export const TakePointFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const buttonLabelText =
    (field['component-parameters'] as unknown as TakePointFieldProps)
      .buttonLabelText ?? '';

  const updateButtonLabel = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      if (value.trim()) {
        nextField['component-parameters'].buttonLabelText = value;
      } else {
        delete nextField['component-parameters'].buttonLabelText;
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const {
    errorText: buttonLabelErrorTxt,
    inputValue: buttonLabelValue,
    validateAndUpdate: validateAndUpdateButtonLabelText,
  } = useTextFieldLengthLimit({
    maxLength: MAX_NUM_CHARACTERS_BUTTON_LENGTH,
    initialValue: buttonLabelText,
  });

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid container>
        <Grid size={{xs: 12, sm: 6}}>
          <SimpleFieldWrapper
            heading="Button Label Text"
            helperText="Custom text for the button. If empty, the field label will be used."
          >
            <DebouncedTextField
              variant="outlined"
              label=""
              value={buttonLabelValue}
              error={!!buttonLabelErrorTxt}
              helperText={buttonLabelErrorTxt}
              placeholder="Leave empty to use the field label"
              onChange={e =>
                validateAndUpdateButtonLabelText(
                  e.target.value,
                  updateButtonLabel
                )
              }
            />
          </SimpleFieldWrapper>
        </Grid>
      </Grid>
    </BaseFieldEditor>
  );
};
