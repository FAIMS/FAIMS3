import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  FormHelperText,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {useMemo} from 'react';
import {
  buildParentFieldTypes,
  compileComputedExpressionForForm,
  ExpressionError,
  ExprType,
  FAIMS_TYPE_TO_EXPR_TYPE,
  PARENT_REFERENCE_PREFIX,
  UiSpecModel,
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

  // The data-model helpers read the uiSpec shape; the designer's slices are
  // structurally compatible.
  const uiSpecForCompile = useMemo(
    () => ({fields: allFields, views, viewsets}) as unknown as UiSpecModel,
    [allFields, views, viewsets]
  );

  const getFieldLabelFor = (id: string) =>
    (allFields[id]?.['component-parameters']?.label as string | undefined) ??
    id;

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

  // Parent fields referenceable as {_PARENT.Field-ID}.
  const parentFieldOptions = useMemo(() => {
    const {types} = buildParentFieldTypes({
      uiSpecification: uiSpecForCompile,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => ({
      ref,
      label: getFieldLabelFor(ref.slice(PARENT_REFERENCE_PREFIX.length)),
    }));
  }, [uiSpecForCompile, viewsetId]);

  // Compile with the per-form wrapper so {_PARENT.Field-ID} references
  // validate against this form's possible parent forms.
  const validationError = useMemo(() => {
    if (expression.trim() === '') return null;
    try {
      compileComputedExpressionForForm({
        source: expression,
        uiSpecification: uiSpecForCompile,
        formId: viewsetId,
        requiredType,
      });
      return null;
    } catch (e) {
      return e instanceof ExpressionError ? e.message : 'Invalid expression';
    }
  }, [expression, uiSpecForCompile, viewsetId, requiredType]);

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
        <Accordion
          disableGutters
          elevation={0}
          sx={{mt: 1, '&:before': {display: 'none'}, background: 'none'}}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon fontSize="small" />}
            sx={{minHeight: 0, p: 0, '& .MuiAccordionSummary-content': {m: 0}}}
          >
            <Typography variant="caption" color="text.secondary">
              Expression syntax
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{p: 0, pb: 1}}>
            <Typography
              variant="caption"
              component="div"
              color="text.secondary"
            >
              Reference fields in braces, e.g. {'{Width}'}. Operators:
              <ul style={{margin: '4px 0', paddingLeft: 18}}>
                <li>Arithmetic (numbers): + - * / %</li>
                <li>
                  Join text: &amp; — e.g. {'{Site-Code}'} &amp; '-' &amp;{' '}
                  {'{Plot}'}
                </li>
                <li>
                  Compare: &lt; &gt; &lt;= &gt;= (two numbers or two texts), ==
                  != (matching types)
                </li>
                <li>Logic (true/false): &amp;&amp; || !</li>
                <li>Conditional: condition ? ifTrue : ifFalse</li>
                <li>
                  Parent record fields: {'{_PARENT.Field-ID}'} - value from the
                  record's parent
                </li>
              </ul>
              The result must be {isText ? 'text' : 'a number'}.
            </Typography>
          </AccordionDetails>
        </Accordion>
        {referenceableFieldCount > 0 ? (
          <>
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
            {parentFieldOptions.length > 0 && (
              <Box sx={{mt: 1, maxWidth: 400}}>
                <FormControl fullWidth size="small">
                  <InputLabel id="parent-field-insert-label">
                    Insert parent field
                  </InputLabel>
                  <Select
                    labelId="parent-field-insert-label"
                    label="Insert parent field"
                    value=""
                    data-testid="computed-parent-field-insert"
                    onChange={e => {
                      if (e.target.value) insertFieldRef(e.target.value);
                    }}
                  >
                    {parentFieldOptions.map(({ref, label}) => (
                      <MenuItem key={ref} value={ref}>
                        {label} ({ref})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </>
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
