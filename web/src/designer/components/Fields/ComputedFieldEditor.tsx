import {Alert, Box, FormHelperText, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {FieldSearchAutocomplete} from '../field-selector';
import {
  applyFieldFilters,
  getViewsetFieldIds,
} from '../../features/field-search';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
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
 * the expression are wrapped in braces, e.g. {Width} * {Height}.
 */
export const ComputedFieldEditor = ({fieldName, viewsetId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(selectUiFields);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);
  const dispatch = useAppDispatch();

  const expression =
    (field['component-parameters'].expression as string | undefined) || '';

  const numericFieldFilters = useMemo(
    () => ({
      excludeFieldIds: [fieldName],
      predicate: (_id: string, f: (typeof allFields)[string]) =>
        isNumericField(f),
    }),
    [fieldName]
  );

  const numericFieldCount = useMemo(
    () =>
      applyFieldFilters(
        getViewsetFieldIds(viewsetId, views, viewsets),
        allFields,
        numericFieldFilters
      ).length,
    [viewsetId, views, viewsets, allFields, numericFieldFilters]
  );

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
        {numericFieldCount > 0 ? (
          <Box sx={{mt: 2, maxWidth: 400}}>
            <FieldSearchAutocomplete
              value={null}
              onChange={fieldId => {
                if (fieldId) insertFieldRef(fieldId);
              }}
              scope={{kind: 'viewset', viewsetId}}
              filters={numericFieldFilters}
              label="Insert field"
              placeholder="Search numeric fields…"
              size="small"
              clearOnSelect
              noOptionsText="No numeric field search results"
              data-testid="computed-field-insert"
            />
          </Box>
        ) : (
          <Alert severity="info" sx={{mt: 2}}>
            No suitable numerical fields for computation in this form. Add
            number, percentage, or other numeric fields to reference them in the
            expression.
          </Alert>
        )}
        <FormHelperText>
          Reference other numeric fields by wrapping their ID in braces.
          {numericFieldCount > 0 &&
            ' Use the field picker above to insert a reference.'}
        </FormHelperText>
      </Box>
    </BaseFieldEditor>
  );
};
