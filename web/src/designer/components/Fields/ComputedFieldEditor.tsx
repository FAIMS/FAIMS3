import {Box, Card, Chip, Grid, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';
import {fieldUpdated} from '../../store/slices/uiSpec';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

// Shape of the ComputedField component-parameters we edit here.
type ComputedFieldParams = {
  label?: string;
  helperText?: string;
  expression?: string;
};

/**
 * Property editor for ComputedField. Exposes the arithmetic expression plus the
 * standard label and helper text. The expression references other field IDs in
 * the same form (e.g. "Width * Height"); the chips below the expression insert
 * a field ID at the end of the expression.
 */
export const ComputedFieldEditor = ({fieldName, viewsetId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const viewSet = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets[viewsetId]
  );
  const views = useAppSelector(state => state.notebook.uiSpec.present.views);
  const dispatch = useAppDispatch();

  const state = field['component-parameters'] as ComputedFieldParams;

  // Other field IDs in this form, excluding the computed field itself (it can't
  // reference its own value).
  const formFieldIds = useMemo(() => {
    const ids = new Set<string>();
    viewSet?.views.forEach(viewId => {
      views[viewId]?.fields.forEach(id => ids.add(id));
    });
    ids.delete(fieldName);
    return Array.from(ids);
  }, [viewSet?.views, views, fieldName]);

  const updateProperty = (prop: keyof ComputedFieldParams, value: string) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newParams = newField['component-parameters'] as ComputedFieldParams;
    newParams[prop] = value;
    dispatch(fieldUpdated({fieldName, newField}));
  };

  // Appends a field ID to the expression, space-separated.
  const insertFieldId = (id: string) => {
    const current = state.expression || '';
    const next = current === '' ? id : `${current} ${id}`;
    updateProperty('expression', next);
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
              helperText="Arithmetic over other field IDs, e.g. Width * Height"
            />
            {formFieldIds.length > 0 && (
              <Box sx={{mt: 2}}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{display: 'block', mb: 1}}
                >
                  Insert a field ID:
                </Typography>
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                  {formFieldIds.map(id => {
                    const label =
                      (
                        allFields[id]?.['component-parameters'] as
                          | {label?: string}
                          | undefined
                      )?.label || id;
                    return (
                      <Chip
                        key={id}
                        label={label === id ? id : `${label} (${id})`}
                        size="small"
                        variant="outlined"
                        onClick={() => insertFieldId(id)}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
};
