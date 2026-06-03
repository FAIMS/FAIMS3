import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

/** Integer vs floating `numberType` and HTML input binding for `NumberField`. */
export const NumberFieldEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const numberType =
    (field['component-parameters'].numberType as 'integer' | 'floating') ||
    'integer';
  const min = field['component-parameters'].min as number | undefined;
  const max = field['component-parameters'].max as number | undefined;

  const handleNumberTypeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedType = event.target.value as 'integer' | 'floating';
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].numberType = selectedType;
      nextField['component-name'] = 'NumberField';
      nextField['component-namespace'] = 'faims-custom';
      nextField['type-returned'] = 'faims-core::Number';
      nextField['component-parameters'].InputProps = {
        ...(nextField['component-parameters'].InputProps ?? {}),
        type: 'number',
      };
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = withUpdatedField(field, nextField => {
      const value = event.target.value.trim();
      if (value === '') {
        delete nextField['component-parameters'].min;
        return;
      }
      const parsed =
        numberType === 'integer' ? parseInt(value, 10) : parseFloat(value);
      if (!isNaN(parsed)) {
        nextField['component-parameters'].min = parsed;
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newField = withUpdatedField(field, nextField => {
      const value = event.target.value.trim();
      if (value === '') {
        delete nextField['component-parameters'].max;
        return;
      }
      const parsed =
        numberType === 'integer' ? parseInt(value, 10) : parseFloat(value);
      if (!isNaN(parsed)) {
        nextField['component-parameters'].max = parsed;
      }
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{width: '100%'}}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mb: 2,
          }}
        >
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
              Integer shows stepper controls and accepts whole numbers only.
              Decimal allows fractional values.
            </FormHelperText>
          </FormControl>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{mb: 1.5, fontWeight: 700, fontSize: '1rem'}}
          >
            Number limits
          </Typography>
          <FormHelperText sx={{mt: 0, mb: 1.25}}>
            Set minimum and/or maximum allowed values. Leave empty for no limit.
          </FormHelperText>
          {/*
           * Compact side-by-side layout: each input is sized to its value
           * (just a number), not stretched across the card. Stacks vertically
           * only on very narrow viewports.
           */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: {xs: 'column', sm: 'row'},
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{width: {xs: '100%', sm: 160}}}>
              <SimpleFieldWrapper heading="Minimum">
                <TextField
                  label=""
                  type="number"
                  value={min ?? ''}
                  onChange={handleMinChange}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </SimpleFieldWrapper>
            </Box>
            <Box sx={{width: {xs: '100%', sm: 160}}}>
              <SimpleFieldWrapper heading="Maximum">
                <TextField
                  label=""
                  type="number"
                  value={max ?? ''}
                  onChange={handleMaxChange}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </SimpleFieldWrapper>
            </Box>
          </Box>
        </Box>
      </Box>
    </BaseFieldEditor>
  );
};
