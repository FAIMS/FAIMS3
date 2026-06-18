import {Box, Card, Grid, Typography} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {fieldUpdated} from '../../store/slices/uiSpec';

type PropType = {
  fieldName: string;
};

// Shape of the ComputedField component-parameters we edit here.
type ComputedFieldParams = {
  label?: string;
  helperText?: string;
  expression?: string;
};

/**
 * Property editor for ComputedField. Exposes the arithmetic expression plus the
 * standard label and helper text. The expression references other field names
 * in the same form (e.g. "width * height").
 */
export const ComputedFieldEditor = ({fieldName}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const state = field['component-parameters'] as ComputedFieldParams;

  const updateProperty = (prop: keyof ComputedFieldParams, value: string) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newParams = newField['component-parameters'] as ComputedFieldParams;
    newParams[prop] = value;
    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Card variant="outlined">
          <Grid container spacing={2} sx={{p: 2}}>
            <Grid size={{xs: 12, sm: 6}}>
              <DebouncedTextField
                name="label"
                variant="outlined"
                label="Label"
                fullWidth
                value={state.label || ''}
                onChange={e => updateProperty('label', e.target.value)}
                helperText="Enter a label for the field"
              />
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
              <DebouncedTextField
                name="helperText"
                variant="outlined"
                label="Helper Text"
                fullWidth
                multiline
                rows={4}
                value={state.helperText || ''}
                helperText="Help text shown along with the field"
                onChange={e => updateProperty('helperText', e.target.value)}
              />
            </Grid>
          </Grid>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card variant="outlined">
          <Box sx={{p: 2}}>
            <Typography variant="subtitle2" sx={{mb: 2}}>
              Expression
            </Typography>
            <DebouncedTextField
              name="expression"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={state.expression || ''}
              onChange={e => updateProperty('expression', e.target.value)}
              helperText="Arithmetic over other field names, e.g. width * height"
            />
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
};
