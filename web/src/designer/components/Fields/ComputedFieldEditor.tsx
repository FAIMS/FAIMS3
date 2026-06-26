import {Box, Chip, FormHelperText, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

// Component names whose fields return a number and so make sense as inputs to a
// computed expression.
const NUMERIC_COMPONENT_NAMES = [
  'NumberField',
  'ControlledNumber',
  'BasicAutoIncrementer',
  'PercentageSlider',
  'ComputedField',
];

// True if the field returns a numeric value (by return type or, failing that,
// by being a known numeric component).
const isNumericField = (field: {
  'type-returned'?: string;
  'component-name'?: string;
}) =>
  field['type-returned'] === 'faims-core::Number' ||
  NUMERIC_COMPONENT_NAMES.includes(field['component-name'] ?? '');

/**
 * Property editor for ComputedField. Uses BaseFieldEditor for the standard
 * field settings and adds the arithmetic expression below. Field references in
 * the expression are wrapped in braces, e.g. {Width} * {Height}; the chips
 * insert a reference for each numeric field in the form.
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

  const expression =
    (field['component-parameters'].expression as string | undefined) || '';

  // Numeric field ids in this form, excluding the computed field itself (it
  // can't reference its own value).
  const numericFieldIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    viewSet?.views.forEach(viewId => {
      views[viewId]?.fields.forEach(id => {
        if (id === fieldName || seen.has(id)) return;
        seen.add(id);
        if (isNumericField(allFields[id] ?? {})) {
          ids.push(id);
        }
      });
    });
    return ids;
  }, [viewSet?.views, views, allFields, fieldName]);

  const updateExpression = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].expression = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  // Appends a braced field reference to the expression, space-separated.
  const insertFieldRef = (id: string) => {
    const ref = `{${id}}`;
    updateExpression(expression === '' ? ref : `${expression} ${ref}`);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{mb: 1}}>
        <Typography variant="subtitle2" sx={{mb: 1}}>
          Expression
        </Typography>
        <DebouncedTextField
          name="expression"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={expression}
          onChange={e => updateExpression(e.target.value)}
          helperText="Arithmetic over other fields, e.g. {Width} * {Height}"
        />
        {numericFieldIds.length > 0 && (
          <Box sx={{mt: 2}}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{display: 'block', mb: 1}}
            >
              Insert a field:
            </Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
              {numericFieldIds.map(id => {
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
                    onClick={() => insertFieldRef(id)}
                  />
                );
              })}
            </Box>
          </Box>
        )}
        <FormHelperText>
          Reference other numeric fields by wrapping their ID in braces. Click a
          field above to insert it.
        </FormHelperText>
      </Box>
    </BaseFieldEditor>
  );
};
