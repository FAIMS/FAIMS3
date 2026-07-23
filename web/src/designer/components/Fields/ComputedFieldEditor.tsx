import {Alert, Box, FormHelperText, Typography} from '@mui/material';
import {useMemo} from 'react';
import {
  compileComputedExpression,
  ExpressionError,
  ExprType,
  FAIMS_TYPE_TO_EXPR_TYPE,
} from '@faims3/data-model';
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

// Component names whose values are derived and so cannot feed an expression.
const DERIVED_COMPONENT_NAMES = [
  'ComputedNumber',
  'ComputedText',
  'TemplatedStringField',
];

// True if the field can be referenced from an expression: its type maps onto
// an expression value type and it is not itself derived.
const isReferenceableField = (field: {
  'type-returned'?: string;
  'component-name'?: string;
}) =>
  FAIMS_TYPE_TO_EXPR_TYPE[field['type-returned'] ?? ''] !== undefined &&
  !DERIVED_COMPONENT_NAMES.includes(field['component-name'] ?? '');

/**
 * Property editor shared by ComputedNumber and ComputedText. Uses
 * BaseFieldEditor for the standard field settings and adds the typed
 * expression below. Field references are wrapped in braces, e.g.
 * {Width} * {Height}; the field picker inserts a reference. The expression is
 * compiled as it changes and compile errors are shown inline.
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
  const isText = field['component-name'] === 'ComputedText';
  const requiredType: ExprType = isText ? 'string' : 'number';

  const referenceableFieldFilters = useMemo(
    () => ({
      excludeFieldIds: [fieldName],
      predicate: (_id: string, f: (typeof allFields)[string]) =>
        isReferenceableField(f),
    }),
    [fieldName]
  );

  const referenceableFieldCount = useMemo(
    () =>
      applyFieldFilters(
        getViewsetFieldIds(viewsetId, views, viewsets),
        allFields,
        referenceableFieldFilters
      ).length,
    [viewsetId, views, viewsets, allFields, referenceableFieldFilters]
  );

  // Compile the expression against the current field types, mirroring the
  // notebook-load compile. Runs when the (debounced) expression or the spec
  // changes; returns the compile error message, or null when valid/empty.
  const validationError = useMemo(() => {
    if (expression.trim() === '') return null;
    const fieldTypes = new Map<string, ExprType>();
    for (const [id, f] of Object.entries(allFields)) {
      const t = FAIMS_TYPE_TO_EXPR_TYPE[f['type-returned'] ?? ''];
      if (t) fieldTypes.set(id, t);
    }
    try {
      compileComputedExpression(expression, fieldTypes, requiredType);
      return null;
    } catch (e) {
      return e instanceof ExpressionError ? e.message : 'Invalid expression';
    }
  }, [expression, allFields, requiredType]);

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
          error={validationError !== null}
          helperText={
            isText
              ? "Text expression over other fields, e.g. {Site-Code} & '-' & {Plot}"
              : 'Numeric expression over other fields, e.g. {Width} * {Height}'
          }
        />
        {validationError && (
          <Alert severity="error" sx={{mt: 1}} data-testid="expression-error">
            {validationError}
          </Alert>
        )}
        {referenceableFieldCount > 0 ? (
          <Box sx={{mt: 2, maxWidth: 400}}>
            <FieldSearchAutocomplete
              value={null}
              onChange={fieldId => {
                if (fieldId) insertFieldRef(fieldId);
              }}
              scope={{kind: 'viewset', viewsetId}}
              filters={referenceableFieldFilters}
              label="Insert field"
              placeholder="Search fields…"
              size="small"
              clearOnSelect
              noOptionsText="No field search results"
              data-testid="computed-field-insert"
            />
          </Box>
        ) : (
          <Alert severity="info" sx={{mt: 2}}>
            No referenceable fields in this form. Add number, text, or checkbox
            fields to reference them in the expression.
          </Alert>
        )}
        <FormHelperText>
          Reference other fields by wrapping their ID in braces.
          {referenceableFieldCount > 0 &&
            ' Use the field picker above to insert a reference.'}
        </FormHelperText>
      </Box>
    </BaseFieldEditor>
  );
};
