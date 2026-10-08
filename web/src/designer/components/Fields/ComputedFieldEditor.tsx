// SPDX-License-Identifier: Apache-2.0
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
import {useMemo, useRef} from 'react';
import {
  buildParentFieldTypes,
  buildRelatedFieldTypes,
  compileComputedExpressionForForm,
  decodeMetadataRef,
  decodeParentRef,
  encodeMetadataRef,
  ExpressionError,
  ExprType,
  extractExpressionReferences,
  FAIMS_TYPE_TO_EXPR_TYPE,
  fieldIdsForViewset,
  isDerivedFieldName,
  isReferenceableMetadataKey,
  splitRelatedReference,
  UiSpecModel,
} from '@faims3/data-model';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {
  ConstantSearchAutocomplete,
  FieldSearchAutocomplete,
} from '../field-selector';
import {applyFieldFilters} from '../../features/field-search';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
  selectCustomMetadata,
} from '../../store/selectors';
import {BaseFieldEditor} from './BaseFieldEditor';
import {
  createChipCatalog,
  ExpressionEditor,
  type ExpressionEditorHandle,
} from '../../features/expression-editor';

/** Props for {@link ComputedFieldEditor}. `viewId` is unused (form comes from `viewsetId`). */
type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

/**
 * Whether a field can appear in `{ref}`: its `type-returned` maps to an
 * expression type and it is not itself a derived component.
 */
const isReferenceableField = (field: {
  'type-returned'?: string;
  'component-name'?: string;
}) =>
  FAIMS_TYPE_TO_EXPR_TYPE[field['type-returned'] ?? ''] !== undefined &&
  !isDerivedFieldName(field['component-name'] ?? '');

/**
 * Property editor shared by ComputedNumber and ComputedText.
 *
 * Adds a chip expression editor under {@link BaseFieldEditor}. The stored
 * value is still `{storageId}`; chips and pickers are display/insert only.
 * The expression is compiled on change and errors show inline.
 */
export const ComputedFieldEditor = ({fieldName, viewsetId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(selectUiFields);
  const custom = useAppSelector(selectCustomMetadata);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);
  const dispatch = useAppDispatch();
  const expressionEditorRef = useRef<ExpressionEditorHandle>(null);

  /** Designer slices cast to the data-model uiSpec shape for compile helpers. */
  const uiSpecForCompile = useMemo(
    () => ({fields: allFields, views, viewsets}) as unknown as UiSpecModel,
    [allFields, views, viewsets]
  );

  /** Designer label for a storage id, or the id if the field has none. */
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
        fieldIdsForViewset({views, viewsets}, viewsetId),
        allFields,
        referenceableFieldFilters
      ).length,
    [viewsetId, views, viewsets, allFields, referenceableFieldFilters]
  );

  /** Parent-form fields insertable as `{_PARENT.Field-ID}`. */
  const parentFieldOptions = useMemo(() => {
    const {types} = buildParentFieldTypes({
      uiSpecification: uiSpecForCompile,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const fieldId = decodeParentRef(ref);
      return {
        ref,
        label: getFieldLabelFor(fieldId ?? ref),
      };
    });
  }, [uiSpecForCompile, viewsetId]);

  /** Linked-record fields insertable as `{Rel-Field-ID.Field-ID}`. */
  const relatedFieldOptions = useMemo(() => {
    const {types} = buildRelatedFieldTypes({
      uiSpecification: uiSpecForCompile,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const parts = splitRelatedReference(ref);
      if (!parts) {
        return {ref, label: getFieldLabelFor(ref)};
      }
      return {
        ref,
        label: `${getFieldLabelFor(parts.relFieldId)} > ${getFieldLabelFor(parts.fieldId)}`,
      };
    });
  }, [uiSpecForCompile, viewsetId]);

  /** Custom metadata keys insertable as `{_METADATA.key}`. */
  const metadataOptions = useMemo(
    () =>
      Object.keys(custom)
        .filter(isReferenceableMetadataKey)
        .map(key => ({ref: encodeMetadataRef(key), label: key})),
    [custom]
  );

  /**
   * Compile error (or missing/unsafe metadata). Empty source is not an error.
   * Uses the per-form wrapper so `{_PARENT…}` is checked against this form.
   */
  const validationError = useMemo(() => {
    if (expression.trim() === '') return null;
    try {
      compileComputedExpressionForForm({
        source: expression,
        uiSpecification: uiSpecForCompile,
        formId: viewsetId,
        requiredType,
      });
      // The compile pass types any key; only the designer knows which exist.
      const metadataKeys = extractExpressionReferences(expression)
        .map(decodeMetadataRef)
        .filter((key): key is string => key !== null);
      const missing = metadataKeys.find(key => !(key in custom));
      if (missing) {
        return `{${encodeMetadataRef(missing)}}: "${missing}" is not a custom metadata key on this notebook (see the Info panel)`;
      }
      const unsafe = metadataKeys.find(key => !isReferenceableMetadataKey(key));
      return unsafe
        ? `{${encodeMetadataRef(unsafe)}}: "${unsafe}" cannot be referenced - rename it to use only letters, numbers, hyphens and underscores`
        : null;
    } catch (e) {
      return e instanceof ExpressionError ? e.message : 'Invalid expression';
    }
  }, [expression, uiSpecForCompile, viewsetId, requiredType, custom]);

  /** Label/kind lookup for chips; rebuilt when fields or metadata change. */
  const catalog = useMemo(
    () =>
      createChipCatalog({
        fields: allFields,
        views,
        viewsets,
        customMetadataKeys: Object.keys(custom),
      }),
    [allFields, views, viewsets, custom]
  );

  /** Persist the raw expression (debounced by the editor). */
  const updateExpression = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].expression = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * Insert `{id}` at the caret. Do not also call {@link updateExpression} —
   * the editor emits `onChange` so Redux echo does not fight the caret.
   */
  const insertFieldRef = (id: string) => {
    expressionEditorRef.current?.insertRef(id);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{mb: 1}}>
        <Typography variant="subtitle2" sx={{mb: 1}}>
          Expression
        </Typography>
        <ExpressionEditor
          ref={expressionEditorRef}
          value={expression}
          onChange={updateExpression}
          catalog={catalog}
          error={validationError !== null}
        />
        <FormHelperText error={validationError !== null}>
          {isText
            ? 'Text expression over other fields. Hover on a field or constant to get more details.'
            : 'Numeric expression over other fields. Hover on a field or constant to get more details.'}
        </FormHelperText>
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
                <li>Arithmetic (numbers): + - * / % ^</li>
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
                <li>
                  Linked record fields: {'{Link-Field-ID.Field-ID}'} - value
                  from the record linked through a single-link Related Records
                  field
                </li>
                <li>
                  Constants: {'{_CONSTANT.PI}'} - also E, SQRT2, SQRT1_2, LN2,
                  LN10, LOG2E, LOG10E
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
            {relatedFieldOptions.length > 0 && (
              <Box sx={{mt: 1, maxWidth: 400}}>
                <FormControl fullWidth size="small">
                  <InputLabel id="related-field-insert-label">
                    Insert linked record field
                  </InputLabel>
                  <Select
                    labelId="related-field-insert-label"
                    label="Insert linked record field"
                    value=""
                    data-testid="computed-related-field-insert"
                    onChange={e => {
                      if (e.target.value) insertFieldRef(e.target.value);
                    }}
                  >
                    {relatedFieldOptions.map(({ref, label}) => (
                      <MenuItem key={ref} value={ref}>
                        {label} ({ref})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            {metadataOptions.length > 0 && (
              <Box sx={{mt: 1, maxWidth: 400}}>
                <FormControl fullWidth size="small">
                  <InputLabel id="metadata-insert-label">
                    Insert notebook metadata
                  </InputLabel>
                  <Select
                    labelId="metadata-insert-label"
                    label="Insert notebook metadata"
                    value=""
                    data-testid="computed-metadata-insert"
                    onChange={e => {
                      if (e.target.value) insertFieldRef(e.target.value);
                    }}
                  >
                    {metadataOptions.map(({ref, label}) => (
                      <MenuItem key={ref} value={ref}>
                        {label} ({ref})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            <Box sx={{mt: 1, maxWidth: 400}}>
              <ConstantSearchAutocomplete
                onSelect={insertFieldRef}
                data-testid="computed-constant-insert"
              />
            </Box>
          </>
        ) : (
          <Alert severity="info" sx={{mt: 2}}>
            No referenceable fields in this form. Add number, text, or checkbox
            fields to reference them in the expression.
          </Alert>
        )}
        <FormHelperText>
          Field references appear as chips. The stored expression uses each
          field's storage id in braces.
          {referenceableFieldCount > 0 &&
            ' Use the field picker above to insert a reference at the caret.'}
        </FormHelperText>
      </Box>
    </BaseFieldEditor>
  );
};
